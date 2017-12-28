import { Transaction } from 'sequelize'
import { VideoPrivacy } from '../../../shared/models/videos'
import { getServerActor } from '../../helpers/utils'
import { VideoModel } from '../../models/video/video'
import { VideoShareModel } from '../../models/video/video-share'
import { sendVideoAnnounceToFollowers } from './send'

async function shareVideoByServerAndChannel (video: VideoModel, t: Transaction) {
  if (video.privacy === VideoPrivacy.PRIVATE) return undefined

  const serverActor = await getServerActor()

  const serverShare = VideoShareModel.create({
    actorId: serverActor.id,
    videoId: video.id
  }, { transaction: t })

  const videoChannelShare = VideoShareModel.create({
    actorId: video.VideoChannel.actorId,
    videoId: video.id
  }, { transaction: t })

  await Promise.all([
    serverShare,
    videoChannelShare
  ])

  return sendVideoAnnounceToFollowers(serverActor, video, t)
}

export {
  shareVideoByServerAndChannel
}
