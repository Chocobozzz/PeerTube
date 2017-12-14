import { Transaction } from 'sequelize'
import { getServerActor } from '../../helpers'
import { VideoModel } from '../../models/video/video'
import { VideoShareModel } from '../../models/video/video-share'
import { sendVideoAnnounceToFollowers } from './send'

async function shareVideoByServer (video: VideoModel, t: Transaction) {
  const serverActor = await getServerActor()

  await VideoShareModel.create({
    actorId: serverActor.id,
    videoId: video.id
  }, { transaction: t })

  return sendVideoAnnounceToFollowers(serverActor, video, t)
}

export {
  shareVideoByServer
}
