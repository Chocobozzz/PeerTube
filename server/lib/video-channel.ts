import * as Sequelize from 'sequelize'
import * as uuidv4 from 'uuid/v4'
import { VideoChannelCreate } from '../../shared/models'
import { AccountModel } from '../models/account/account'
import { VideoChannelModel } from '../models/video/video-channel'
import { buildActorInstance, getVideoChannelActivityPubUrl } from './activitypub'

async function createVideoChannel (videoChannelInfo: VideoChannelCreate, account: AccountModel, t: Sequelize.Transaction) {
  const uuid = uuidv4()
  const url = getVideoChannelActivityPubUrl(uuid)
  // We use the name as uuid
  const actorInstance = buildActorInstance('Group', url, uuid, uuid)

  const actorInstanceCreated = await actorInstance.save({ transaction: t })

  const videoChannelData = {
    name: videoChannelInfo.displayName,
    description: videoChannelInfo.description,
    support: videoChannelInfo.support,
    accountId: account.id,
    actorId: actorInstanceCreated.id
  }

  const videoChannel = VideoChannelModel.build(videoChannelData)

  const options = { transaction: t }
  const videoChannelCreated = await videoChannel.save(options)

  // Do not forget to add Account/Actor information to the created video channel
  videoChannelCreated.Account = account
  videoChannelCreated.Actor = actorInstanceCreated

  // No need to seed this empty video channel to followers
  return videoChannelCreated
}

// ---------------------------------------------------------------------------

export {
  createVideoChannel
}
