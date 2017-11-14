import * as Sequelize from 'sequelize'

import { database as db } from '../initializers'
import { logger } from '../helpers'
import { AccountInstance } from '../models'
import { VideoChannelCreate } from '../../shared/models'
import { sendCreateVideoChannel } from './activitypub/send-request'
import { getActivityPubUrl } from '../helpers/activitypub'

async function createVideoChannel (videoChannelInfo: VideoChannelCreate, account: AccountInstance, t: Sequelize.Transaction) {
  const videoChannelData = {
    name: videoChannelInfo.name,
    description: videoChannelInfo.description,
    remote: false,
    accountId: account.id
  }

  const videoChannel = db.VideoChannel.build(videoChannelData)
  videoChannel.set('url', getActivityPubUrl('videoChannel', videoChannel.uuid))

  const options = { transaction: t }

  const videoChannelCreated = await videoChannel.save(options)

  // Do not forget to add Account information to the created video channel
  videoChannelCreated.Account = account

  sendCreateVideoChannel(videoChannelCreated, t)

  return videoChannelCreated
}

async function fetchVideoChannelByHostAndUUID (podHost: string, uuid: string, t: Sequelize.Transaction) {
  try {
    const videoChannel = await db.VideoChannel.loadByHostAndUUID(podHost, uuid, t)
    if (!videoChannel) throw new Error('Video channel not found')

    return videoChannel
  } catch (err) {
    logger.error('Cannot load video channel from host and uuid.', { error: err.stack, podHost, uuid })
    throw err
  }
}

// ---------------------------------------------------------------------------

export {
  createVideoChannel,
  fetchVideoChannelByHostAndUUID
}
