import { Transaction } from 'sequelize'
import { VideoPrivacy } from '../../../shared/models/videos'
import { getServerActor } from '../../helpers/utils'
import { VideoModel } from '../../models/video/video'
import { VideoShareModel } from '../../models/video/video-share'
import { sendUndoAnnounce, sendVideoAnnounce } from './send'
import { getVideoAnnounceActivityPubUrl } from './url'
import { VideoChannelModel } from '../../models/video/video-channel'
import * as Bluebird from 'bluebird'
import { doRequest } from '../../helpers/requests'
import { getOrCreateActorAndServerAndModel } from './actor'
import { logger } from '../../helpers/logger'
import { CRAWL_REQUEST_CONCURRENCY } from '../../initializers'
import { checkUrlsSameHost, getAPId } from '../../helpers/activitypub'

async function shareVideoByServerAndChannel (video: VideoModel, t: Transaction) {
  if (video.privacy === VideoPrivacy.PRIVATE) return undefined

  return Promise.all([
    shareByServer(video, t),
    shareByVideoChannel(video, t)
  ])
}

async function changeVideoChannelShare (video: VideoModel, oldVideoChannel: VideoChannelModel, t: Transaction) {
  logger.info('Updating video channel of video %s: %s -> %s.', video.uuid, oldVideoChannel.name, video.VideoChannel.name)

  await undoShareByVideoChannel(video, oldVideoChannel, t)

  await shareByVideoChannel(video, t)
}

async function addVideoShares (shareUrls: string[], instance: VideoModel) {
  await Bluebird.map(shareUrls, async shareUrl => {
    try {
      // Fetch url
      const { body } = await doRequest({
        uri: shareUrl,
        json: true,
        activityPub: true
      })
      if (!body || !body.actor) throw new Error('Body or body actor is invalid')

      const actorUrl = getAPId(body.actor)
      if (checkUrlsSameHost(shareUrl, actorUrl) !== true) {
        throw new Error(`Actor url ${actorUrl} has not the same host than the share url ${shareUrl}`)
      }

      const actor = await getOrCreateActorAndServerAndModel(actorUrl)

      const entry = {
        actorId: actor.id,
        videoId: instance.id,
        url: shareUrl
      }

      await VideoShareModel.upsert(entry)
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

async function shareByServer (video: VideoModel, t: Transaction) {
  const serverActor = await getServerActor()

  const serverShareUrl = getVideoAnnounceActivityPubUrl(serverActor, video)
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

async function shareByVideoChannel (video: VideoModel, t: Transaction) {
  const videoChannelShareUrl = getVideoAnnounceActivityPubUrl(video.VideoChannel.Actor, video)
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

async function undoShareByVideoChannel (video: VideoModel, oldVideoChannel: VideoChannelModel, t: Transaction) {
  // Load old share
  const oldShare = await VideoShareModel.load(oldVideoChannel.actorId, video.id, t)
  if (!oldShare) return new Error('Cannot find old video channel share ' + oldVideoChannel.actorId + ' for video ' + video.id)

  await sendUndoAnnounce(oldVideoChannel.Actor, oldShare, video, t)
  await oldShare.destroy({ transaction: t })
}
