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
    'Updating video channel of video %s: %s -> %s.', video.uuid, oldVideoChannel.name, video.VideoChannel.name,
    lTags(video.uuid)
  )

  await undoShareByVideoChannel(video, oldVideoChannel, t)

  await shareByVideoChannel(video, t)
}

export async function addVideoShares (shareUrls: string[], video: MVideoId) {
  await Bluebird.map(shareUrls, async shareUrl => {
    try {
      await addVideoShare(shareUrl, video)
    } catch (err) {
      logger.warn('Cannot add share %s.', shareUrl, { err })
    }
  }, { concurrency: CRAWL_REQUEST_CONCURRENCY })
}

export async function shareByServer (video: MVideo, t: Transaction) {
  const serverActor = await getServerActor()

  const serverShareUrl = getLocalVideoAnnounceActivityPubUrl(serverActor, video)
  const [ serverShare ] = await VideoShareModel.findOrCreate({
    defaults: {
      actorId: serverActor.id,
      videoId: video.id,
      url: serverShareUrl
    },
    where: {
      url: serverShareUrl
    },
    transaction: t
  })

  return sendVideoAnnounce(serverActor, serverShare, video, t)
}

export async function shareByVideoChannel (video: MVideoAccountLight, t: Transaction) {
  const videoChannelShareUrl = getLocalVideoAnnounceActivityPubUrl(video.VideoChannel.Actor, video)
  const [ videoChannelShare ] = await VideoShareModel.findOrCreate({
    defaults: {
      actorId: video.VideoChannel.actorId,
      videoId: video.id,
      url: videoChannelShareUrl
    },
    where: {
      url: videoChannelShareUrl
    },
    transaction: t
  })

  return sendVideoAnnounce(video.VideoChannel.Actor, videoChannelShare, video, t)
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
  const oldShare = await VideoShareModel.load(oldVideoChannel.actorId, video.id, t)
  if (!oldShare) return new Error('Cannot find old video channel share ' + oldVideoChannel.actorId + ' for video ' + video.id)

  await sendUndoAnnounce(oldVideoChannel.Actor, oldShare, video, t)
  await oldShare.destroy({ transaction: t })
}
