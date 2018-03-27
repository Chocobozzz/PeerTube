import { Transaction } from 'sequelize'
import { VideoPrivacy } from '../../../shared/models/videos'
import { getServerActor } from '../../helpers/utils'
import { VideoModel } from '../../models/video/video'
import { VideoShareModel } from '../../models/video/video-share'
import { sendVideoAnnounce } from './send'
import { getAnnounceActivityPubUrl } from './url'

async function shareVideoByServerAndChannel (video: VideoModel, t: Transaction) {
  if (video.privacy === VideoPrivacy.PRIVATE) return undefined

  const serverActor = await getServerActor()

  const serverShareUrl = getAnnounceActivityPubUrl(video.url, serverActor)
  const serverSharePromise = VideoShareModel.findOrCreate({
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

  const videoChannelShareUrl = getAnnounceActivityPubUrl(video.url, video.VideoChannel.Actor)
  const videoChannelSharePromise = VideoShareModel.findOrCreate({
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
    if (created) return sendVideoAnnounce(serverActor, videoChannelShare, video, t)

    return undefined
  })

  return Promise.all([
    serverSharePromise,
    videoChannelSharePromise
  ])
}

export {
  shareVideoByServerAndChannel
}
