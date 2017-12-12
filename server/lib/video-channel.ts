import * as Sequelize from 'sequelize'
import { VideoChannelCreate } from '../../shared/models'
import { AccountModel } from '../models/account/account'
import { VideoChannelModel } from '../models/video/video-channel'
import { getVideoChannelActivityPubUrl } from './activitypub'

async function createVideoChannel (videoChannelInfo: VideoChannelCreate, account: AccountModel, t: Sequelize.Transaction) {
  const videoChannelData = {
    name: videoChannelInfo.name,
    description: videoChannelInfo.description,
    remote: false,
    accountId: account.id
  }

  const videoChannel = VideoChannelModel.build(videoChannelData)
  videoChannel.set('url', getVideoChannelActivityPubUrl(videoChannel))

  const options = { transaction: t }

  const videoChannelCreated = await videoChannel.save(options)

  // Do not forget to add Account information to the created video channel
  videoChannelCreated.Account = account

  // No need to seed this empty video channel to followers
  return videoChannelCreated
}

// ---------------------------------------------------------------------------

export {
  createVideoChannel
}
