import * as Sequelize from 'sequelize'
import { VideoChannelCreate } from '../../shared/models'
import { database as db } from '../initializers'
import { AccountInstance } from '../models'
import { getVideoChannelActivityPubUrl } from './activitypub/url'

async function createVideoChannel (videoChannelInfo: VideoChannelCreate, account: AccountInstance, t: Sequelize.Transaction) {
  const videoChannelData = {
    name: videoChannelInfo.name,
    description: videoChannelInfo.description,
    remote: false,
    accountId: account.id
  }

  const videoChannel = db.VideoChannel.build(videoChannelData)
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
