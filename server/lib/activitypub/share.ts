import { Transaction } from 'sequelize'
import { VideoPrivacy } from '../../../shared/models/videos'
import { getServerActor } from '../../helpers/utils'
import { VideoModel } from '../../models/video/video'
import { VideoShareModel } from '../../models/video/video-share'
import { sendVideoAnnounceToFollowers } from './send'
import { getAnnounceActivityPubUrl } from './url'

async function shareVideoByServerAndChannel (video: VideoModel, t: Transaction) {
  if (video.privacy === VideoPrivacy.PRIVATE) return undefined

  const serverActor = await getServerActor()

  const serverShareUrl = getAnnounceActivityPubUrl(video.url, serverActor)
  const serverSharePromise = VideoShareModel.create({
    actorId: serverActor.id,
    videoId: video.id,
    url: serverShareUrl
  }, { transaction: t })

  const videoChannelShareUrl = getAnnounceActivityPubUrl(video.url, video.VideoChannel.Actor)
  const videoChannelSharePromise = VideoShareModel.create({
    actorId: video.VideoChannel.actorId,
    videoId: video.id,
    url: videoChannelShareUrl
  }, { transaction: t })

  const [ serverShare, videoChannelShare ] = await Promise.all([
    serverSharePromise,
    videoChannelSharePromise
  ])

  return Promise.all([
    sendVideoAnnounceToFollowers(serverActor, videoChannelShare, video, t),
    sendVideoAnnounceToFollowers(serverActor, serverShare, video, t)
  ])
}

export {
  shareVideoByServerAndChannel
}
