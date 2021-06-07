import * as Bluebird from 'bluebird'
import { Transaction } from 'sequelize'
import { getServerActor } from '@server/models/application/application'
import { checkUrlsSameHost, getAPId } from '../../helpers/activitypub'
import { logger, loggerTagsFactory } from '../../helpers/logger'
import { doJSONRequest } from '../../helpers/requests'
import { CRAWL_REQUEST_CONCURRENCY } from '../../initializers/constants'
import { VideoShareModel } from '../../models/video/video-share'
import { MChannelActorLight, MVideo, MVideoAccountLight, MVideoId } from '../../types/models/video'
import { getOrCreateAPActor } from './actors'
import { sendUndoAnnounce, sendVideoAnnounce } from './send'
import { getLocalVideoAnnounceActivityPubUrl } from './url'

const lTags = loggerTagsFactory('share')

async function shareVideoByServerAndChannel (video: MVideoAccountLight, t: Transaction) {
  if (!video.hasPrivacyForFederation()) return undefined

  return Promise.all([
    shareByServer(video, t),
    shareByVideoChannel(video, t)
  ])
}

async function changeVideoChannelShare (
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

async function addVideoShares (shareUrls: string[], video: MVideoId) {
  await Bluebird.map(shareUrls, async shareUrl => {
    try {
      await addVideoShare(shareUrl, video)
    } catch (err) {
      logger.warn('Cannot add share %s.', shareUrl, { err })
    }
  }, { concurrency: CRAWL_REQUEST_CONCURRENCY })
}

export {
  changeVideoChannelShare,
  addVideoShares,
  shareVideoByServerAndChannel
}

// ---------------------------------------------------------------------------

async function addVideoShare (shareUrl: string, video: MVideoId) {
  const { body } = await doJSONRequest<any>(shareUrl, { activityPub: true })
  if (!body || !body.actor) throw new Error('Body or body actor is invalid')

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

async function shareByServer (video: MVideo, t: Transaction) {
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

async function shareByVideoChannel (video: MVideoAccountLight, t: Transaction) {
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

async function undoShareByVideoChannel (video: MVideo, oldVideoChannel: MChannelActorLight, t: Transaction) {
  // Load old share
  const oldShare = await VideoShareModel.load(oldVideoChannel.actorId, video.id, t)
  if (!oldShare) return new Error('Cannot find old video channel share ' + oldVideoChannel.actorId + ' for video ' + video.id)

  await sendUndoAnnounce(oldVideoChannel.Actor, oldShare, video, t)
  await oldShare.destroy({ transaction: t })
}
