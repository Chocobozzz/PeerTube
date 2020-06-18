import * as Sequelize from 'sequelize'
import { v4 as uuidv4 } from 'uuid'
import { VideoChannelCreate } from '../../shared/models'
import { VideoChannelModel } from '../models/video/video-channel'
import { buildActorInstance } from './activitypub/actor'
import { VideoModel } from '../models/video/video'
import { MAccountId, MChannelDefault, MChannelId } from '../types/models'
import { getVideoChannelActivityPubUrl } from './activitypub/url'
import { federateVideoIfNeeded } from './activitypub/videos'

type CustomVideoChannelModelAccount <T extends MAccountId> = MChannelDefault & { Account?: T }

async function createLocalVideoChannel <T extends MAccountId> (
  videoChannelInfo: VideoChannelCreate,
  account: T,
  t: Sequelize.Transaction
): Promise<CustomVideoChannelModelAccount<T>> {
  const uuid = uuidv4()
  const url = getVideoChannelActivityPubUrl(videoChannelInfo.name)
  const actorInstance = buildActorInstance('Group', url, videoChannelInfo.name, uuid)

  const actorInstanceCreated = await actorInstance.save({ transaction: t })

  const videoChannelData = {
    name: videoChannelInfo.displayName,
    description: videoChannelInfo.description,
    support: videoChannelInfo.support,
    accountId: account.id,
    actorId: actorInstanceCreated.id
  }

  const videoChannel = new VideoChannelModel(videoChannelData)

  const options = { transaction: t }
  const videoChannelCreated: CustomVideoChannelModelAccount<T> = await videoChannel.save(options) as MChannelDefault

  // Do not forget to add Account/Actor information to the created video channel
  videoChannelCreated.Account = account
  videoChannelCreated.Actor = actorInstanceCreated

  // No need to seed this empty video channel to followers
  return videoChannelCreated
}

async function federateAllVideosOfChannel (videoChannel: MChannelId) {
  const videoIds = await VideoModel.getAllIdsFromChannel(videoChannel)

  for (const videoId of videoIds) {
    const video = await VideoModel.loadAndPopulateAccountAndServerAndTags(videoId)

    await federateVideoIfNeeded(video, false)
  }
}

// ---------------------------------------------------------------------------

export {
  createLocalVideoChannel,
  federateAllVideosOfChannel
}
