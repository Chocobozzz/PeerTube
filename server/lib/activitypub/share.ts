import { Transaction } from 'sequelize'
import { getServerAccount } from '../../helpers/utils'
import { database as db } from '../../initializers'
import { VideoChannelInstance } from '../../models/index'
import { VideoInstance } from '../../models/video/video-interface'
import { sendVideoAnnounceToFollowers, sendVideoChannelAnnounceToFollowers } from './send/send-announce'

async function shareVideoChannelByServer (videoChannel: VideoChannelInstance, t: Transaction) {
  const serverAccount = await getServerAccount()

  await db.VideoChannelShare.create({
    accountId: serverAccount.id,
    videoChannelId: videoChannel.id
  }, { transaction: t })

  return sendVideoChannelAnnounceToFollowers(serverAccount, videoChannel, t)
}

async function shareVideoByServer (video: VideoInstance, t: Transaction) {
  const serverAccount = await getServerAccount()

  await db.VideoShare.create({
    accountId: serverAccount.id,
    videoId: video.id
  }, { transaction: t })

  return sendVideoAnnounceToFollowers(serverAccount, video, t)
}

export {
  shareVideoChannelByServer,
  shareVideoByServer
}
