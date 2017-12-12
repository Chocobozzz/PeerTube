import { Transaction } from 'sequelize'
import { getServerAccount } from '../../helpers'
import { VideoModel } from '../../models/video/video'
import { VideoChannelModel } from '../../models/video/video-channel'
import { VideoChannelShareModel } from '../../models/video/video-channel-share'
import { VideoShareModel } from '../../models/video/video-share'
import { sendVideoAnnounceToFollowers, sendVideoChannelAnnounceToFollowers } from './send'

async function shareVideoChannelByServer (videoChannel: VideoChannelModel, t: Transaction) {
  const serverAccount = await getServerAccount()

  await VideoChannelShareModel.create({
    accountId: serverAccount.id,
    videoChannelId: videoChannel.id
  }, { transaction: t })

  return sendVideoChannelAnnounceToFollowers(serverAccount, videoChannel, t)
}

async function shareVideoByServer (video: VideoModel, t: Transaction) {
  const serverAccount = await getServerAccount()

  await VideoShareModel.create({
    accountId: serverAccount.id,
    videoId: video.id
  }, { transaction: t })

  return sendVideoAnnounceToFollowers(serverAccount, video, t)
}

export {
  shareVideoChannelByServer,
  shareVideoByServer
}
