import { Transaction } from 'sequelize'
import { VideoPrivacy } from '../../../shared/models/videos'
import { getServerActor } from '../../helpers/utils'
import { VideoModel } from '../../models/video/video'
import { VideoShareModel } from '../../models/video/video-share'
import { sendUndoAnnounce, sendVideoAnnounce } from './send'
import { getAnnounceActivityPubUrl } from './url'
import { VideoChannelModel } from '../../models/video/video-channel'

async function shareVideoByServerAndChannel (video: VideoModel, t: Transaction) {
  if (video.privacy === VideoPrivacy.PRIVATE) return undefined

  return Promise.all([
    shareByServer(video, t),
    shareByVideoChannel(video, t)
  ])
}

async function changeVideoChannelShare (video: VideoModel, oldVideoChannel: VideoChannelModel, t: Transaction) {
  await undoShareByVideoChannel(video, oldVideoChannel, t)

  await shareByVideoChannel(video, t)
}

export {
  changeVideoChannelShare,
  shareVideoByServerAndChannel
}

// ---------------------------------------------------------------------------

async function shareByServer (video: VideoModel, t: Transaction) {
  const serverActor = await getServerActor()

  const serverShareUrl = getAnnounceActivityPubUrl(video.url, serverActor)
  return VideoShareModel.findOrCreate({
    defaults: {
      actorId: serverActor.id,
      videoId: video.id,
      url: serverShareUrl
    },
    where: {
      url: serverShareUrl
    },
    transaction: t
  }).then(([ serverShare, created ]) => {
    if (created) return sendVideoAnnounce(serverActor, serverShare, video, t)

    return undefined
  })
}

async function shareByVideoChannel (video: VideoModel, t: Transaction) {
  const videoChannelShareUrl = getAnnounceActivityPubUrl(video.url, video.VideoChannel.Actor)
  return VideoShareModel.findOrCreate({
    defaults: {
      actorId: video.VideoChannel.actorId,
      videoId: video.id,
      url: videoChannelShareUrl
    },
    where: {
      url: videoChannelShareUrl
    },
    transaction: t
  }).then(([ videoChannelShare, created ]) => {
    if (created) return sendVideoAnnounce(video.VideoChannel.Actor, videoChannelShare, video, t)

    return undefined
  })
}

async function undoShareByVideoChannel (video: VideoModel, oldVideoChannel: VideoChannelModel, t: Transaction) {
  // Load old share
  const oldShare = await VideoShareModel.load(oldVideoChannel.actorId, video.id, t)
  if (!oldShare) return new Error('Cannot find old video channel share ' + oldVideoChannel.actorId + ' for video ' + video.id)

  await sendUndoAnnounce(oldVideoChannel.Actor, oldShare, video, t)
  await oldShare.destroy({ transaction: t })
}
