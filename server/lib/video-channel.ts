import * as Sequelize from 'sequelize'
import { VideoChannelCreate } from '../../shared/models'
import { logger } from '../helpers'
import { database as db } from '../initializers'
import { AccountInstance } from '../models'
import { getVideoChannelActivityPubUrl } from '../helpers/activitypub'

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

async function fetchVideoChannelByHostAndUUID (serverHost: string, uuid: string, t: Sequelize.Transaction) {
  try {
    const videoChannel = await db.VideoChannel.loadByHostAndUUID(serverHost, uuid, t)
    if (!videoChannel) throw new Error('Video channel not found')

    return videoChannel
  } catch (err) {
    logger.error('Cannot load video channel from host and uuid.', { error: err.stack, serverHost, uuid })
    throw err
  }
}

// ---------------------------------------------------------------------------

export {
  createVideoChannel,
  fetchVideoChannelByHostAndUUID
}
