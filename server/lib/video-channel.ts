import * as Sequelize from 'sequelize'

import { addVideoChannelToFriends } from './friends'
import { database as db } from '../initializers'
import { logger } from '../helpers'
import { AccountInstance } from '../models'
import { VideoChannelCreate } from '../../shared/models'

async function createVideoChannel (videoChannelInfo: VideoChannelCreate, account: AccountInstance, t: Sequelize.Transaction) {
  const videoChannelData = {
    name: videoChannelInfo.name,
    description: videoChannelInfo.description,
    remote: false,
    accountId: account.id
  }

  const videoChannel = db.VideoChannel.build(videoChannelData)
  const options = { transaction: t }

  const videoChannelCreated = await videoChannel.save(options)

  // Do not forget to add Account information to the created video channel
  videoChannelCreated.Account = account

  const remoteVideoChannel = videoChannelCreated.toAddRemoteJSON()

  // Now we'll add the video channel's meta data to our friends
  await addVideoChannelToFriends(remoteVideoChannel, t)

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
