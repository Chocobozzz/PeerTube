import { HttpStatusCode } from '@peertube/peertube-models'
import { getServerActor } from '@server/models/application/application.js'
import Bluebird from 'bluebird'
import { Transaction } from 'sequelize'
import { logger, loggerTagsFactory } from '../../helpers/logger.js'
import { CRAWL_REQUEST_CONCURRENCY } from '../../initializers/constants.js'
import { VideoShareModel } from '../../models/video/video-share.js'
import { MChannelActorLight, MVideo, MVideoAccountLight, MVideoId } from '../../types/models/video/index.js'
import { fetchAP, getAPId } from './activity.js'
import { getOrCreateAPActor } from './actors/index.js'
import { sendUndoAnnounce, sendVideoAnnounce } from './send/index.js'
import { checkUrlsSameHost, getLocalVideoAnnounceActivityPubUrl } from './url.js'

const lTags = loggerTagsFactory('share')

export async function changeVideoChannelShare (
  video: MVideoAccountLight,
  oldVideoChannel: MChannelActorLight,
  t: Transaction
) {
  logger.info(
    'Updating video channel of video %s: %s -> %s.',
    video.uuid,
    oldVideoChannel.name,
    video.VideoChannel.name,
    lTags(video.uuid)
  )

  await undoShareByVideoChannel(video, oldVideoChannel, t)

  await shareByVideoChannelIfNeeded({ video, skipFederation: false, transaction: t })
}

export async function addVideoShares (shareUrls: string[], video: MVideoId) {
  await Bluebird.map(shareUrls, async shareUrl => {
    try {
      await addVideoShare(shareUrl, video)
    } catch (err) {
      if (err.statusCode === HttpStatusCode.NOT_FOUND_404 || err.statusCode === HttpStatusCode.GONE_410) {
        logger.debug(`Cannot add share ${shareUrl} that does not exist anymore`, { err })
        return
      }

      logger.info(`Cannot add share ${shareUrl}`, { err })
    }
  }, { concurrency: CRAWL_REQUEST_CONCURRENCY })
}

export async function isSharedByServer (options: {
  video: MVideo
  transaction: Transaction
}) {
  const { video, transaction } = options

  const serverActor = await getServerActor()

  const serverShareUrl = getLocalVideoAnnounceActivityPubUrl(serverActor, video)

  const share = await VideoShareModel.loadByUrl(serverShareUrl, transaction)

  return !!share
}

export async function shareByServerIfNeeded (options: {
  video: MVideo
  skipFederation: boolean
  transaction: Transaction
}) {
  const { video, skipFederation, transaction } = options

  const serverActor = await getServerActor()

  const serverShareUrl = getLocalVideoAnnounceActivityPubUrl(serverActor, video)

  let share = await VideoShareModel.loadByUrl(serverShareUrl, transaction)
  if (share) return

  share = await VideoShareModel.create({
    actorId: serverActor.id,
    videoId: video.id,
    url: serverShareUrl
  }, { transaction: transaction })

  if (skipFederation !== true) {
    await sendVideoAnnounce({ byActor: serverActor, videoShare: share, video, transaction: transaction })
  }
}

export async function shareByVideoChannelIfNeeded (options: {
  video: MVideoAccountLight
  skipFederation: boolean
  transaction: Transaction
}) {
  const { video, skipFederation, transaction } = options

  const videoChannelShareUrl = getLocalVideoAnnounceActivityPubUrl(video.VideoChannel.Actor, video)

  let share = await VideoShareModel.loadByUrl(videoChannelShareUrl, transaction)
  if (share) return

  share = await VideoShareModel.create({
    actorId: video.VideoChannel.Actor.id,
    videoId: video.id,
    url: videoChannelShareUrl
  }, { transaction: transaction })

  if (skipFederation !== true) {
    await sendVideoAnnounce({ byActor: video.VideoChannel.Actor, videoShare: share, video, transaction: transaction })
  }
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

async function addVideoShare (shareUrl: string, video: MVideoId) {
  const { body } = await fetchAP<any>(shareUrl)
  if (!body?.actor) throw new Error('Body or body actor is invalid')

  const actorUrl = getAPId(body.actor)
  if (checkUrlsSameHost(shareUrl, actorUrl) !== true) {
    throw new Error(`Actor url ${actorUrl} has not the same host than the share url ${shareUrl}`)
  }

  const actor = await getOrCreateAPActor(actorUrl)

  const entry = {
    actorId: actor.id,
    videoId: video.id,
    url: shareUrl
  }

  await VideoShareModel.upsert(entry)
}

async function undoShareByVideoChannel (video: MVideo, oldVideoChannel: MChannelActorLight, t: Transaction) {
  // Load old share
  const oldShare = await VideoShareModel.load(oldVideoChannel.Actor.id, video.id, t)
  if (!oldShare) return new Error(`Cannot find old video channel share ${oldVideoChannel.Actor.id} for video ${video.id}`)

  await sendUndoAnnounce(oldVideoChannel.Actor, oldShare, video, t)
  await oldShare.destroy({ transaction: t })
}
