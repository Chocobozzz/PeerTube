import * as Sequelize from 'sequelize'
import { VideoChannelCreate } from '../../shared/models'
import { VideoModel } from '../models/video/video'
import { VideoChannelModel } from '../models/video/video-channel'
import { MAccountId, MChannelId } from '../types/models'
import { getLocalVideoChannelActivityPubUrl } from './activitypub/url'
import { federateVideoIfNeeded } from './activitypub/videos'
import { buildActorInstance } from './local-actor'

async function createLocalVideoChannel (videoChannelInfo: VideoChannelCreate, account: MAccountId, t: Sequelize.Transaction) {
  const url = getLocalVideoChannelActivityPubUrl(videoChannelInfo.name)
  const actorInstance = buildActorInstance('Group', url, videoChannelInfo.name)

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
  const videoChannelCreated = await videoChannel.save(options)

  videoChannelCreated.Actor = actorInstanceCreated

  // No need to send this empty video channel to followers
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
