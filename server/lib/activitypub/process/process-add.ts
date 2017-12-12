import * as Bluebird from 'bluebird'
import { VideoTorrentObject } from '../../../../shared'
import { ActivityAdd } from '../../../../shared/models/activitypub'
import { VideoRateType } from '../../../../shared/models/videos'
import { logger, retryTransactionWrapper } from '../../../helpers'
import { sequelizeTypescript } from '../../../initializers'
import { AccountModel } from '../../../models/account/account'
import { AccountVideoRateModel } from '../../../models/account/account-video-rate'
import { TagModel } from '../../../models/video/tag'
import { VideoModel } from '../../../models/video/video'
import { VideoChannelModel } from '../../../models/video/video-channel'
import { VideoFileModel } from '../../../models/video/video-file'
import { getOrCreateAccountAndServer } from '../account'
import { getOrCreateVideoChannel } from '../video-channels'
import { generateThumbnailFromUrl } from '../videos'
import { addVideoShares, videoActivityObjectToDBAttributes, videoFileActivityUrlToDBAttributes } from './misc'

async function processAddActivity (activity: ActivityAdd) {
  const activityObject = activity.object
  const activityType = activityObject.type
  const account = await getOrCreateAccountAndServer(activity.actor)

  if (activityType === 'Video') {
    const videoChannelUrl = activity.target
    const videoChannel = await getOrCreateVideoChannel(account, videoChannelUrl)

    return processAddVideo(account, activity, videoChannel, activityObject)
  }

  logger.warn('Unknown activity object type %s when creating activity.', activityType, { activity: activity.id })
  return Promise.resolve(undefined)
}

// ---------------------------------------------------------------------------

export {
  processAddActivity
}

// ---------------------------------------------------------------------------

async function processAddVideo (account: AccountModel,
                                activity: ActivityAdd,
                                videoChannel: VideoChannelModel,
                                videoToCreateData: VideoTorrentObject) {
  const options = {
    arguments: [ account, activity, videoChannel, videoToCreateData ],
    errorMessage: 'Cannot insert the remote video with many retries.'
  }

  const video = await retryTransactionWrapper(addRemoteVideo, options)

  // Process outside the transaction because we could fetch remote data
  if (videoToCreateData.likes && Array.isArray(videoToCreateData.likes.orderedItems)) {
    await createRates(videoToCreateData.likes.orderedItems, video, 'like')
  }

  if (videoToCreateData.dislikes && Array.isArray(videoToCreateData.dislikes.orderedItems)) {
    await createRates(videoToCreateData.dislikes.orderedItems, video, 'dislike')
  }

  if (videoToCreateData.shares && Array.isArray(videoToCreateData.shares.orderedItems)) {
    await addVideoShares(video, videoToCreateData.shares.orderedItems)
  }

  return video
}

function addRemoteVideo (account: AccountModel,
                         activity: ActivityAdd,
                         videoChannel: VideoChannelModel,
                         videoToCreateData: VideoTorrentObject) {
  logger.debug('Adding remote video %s.', videoToCreateData.id)

  return sequelizeTypescript.transaction(async t => {
    const sequelizeOptions = {
      transaction: t
    }

    if (videoChannel.Account.id !== account.id) throw new Error('Video channel is not owned by this account.')

    const videoFromDatabase = await VideoModel.loadByUUIDOrURL(videoToCreateData.uuid, videoToCreateData.id, t)
    if (videoFromDatabase) return videoFromDatabase

    const videoData = await videoActivityObjectToDBAttributes(videoChannel, videoToCreateData, activity.to, activity.cc)
    const video = VideoModel.build(videoData)

    // Don't block on request
    generateThumbnailFromUrl(video, videoToCreateData.icon)
      .catch(err => logger.warn('Cannot generate thumbnail of %s.', videoToCreateData.id, err))

    const videoCreated = await video.save(sequelizeOptions)

    const videoFileAttributes = videoFileActivityUrlToDBAttributes(videoCreated, videoToCreateData)
    if (videoFileAttributes.length === 0) {
      throw new Error('Cannot find valid files for video %s ' + videoToCreateData.url)
    }

    const tasks: Bluebird<any>[] = videoFileAttributes.map(f => VideoFileModel.create(f, { transaction: t }))
    await Promise.all(tasks)

    const tags = videoToCreateData.tag.map(t => t.name)
    const tagInstances = await TagModel.findOrCreateTags(tags, t)
    await videoCreated.$set('Tags', tagInstances, sequelizeOptions)

    logger.info('Remote video with uuid %s inserted.', videoToCreateData.uuid)

    return videoCreated
  })
}

async function createRates (accountUrls: string[], video: VideoModel, rate: VideoRateType) {
  let rateCounts = 0
  const tasks: Bluebird<any>[] = []

  for (const accountUrl of accountUrls) {
    const account = await getOrCreateAccountAndServer(accountUrl)
    const p = AccountVideoRateModel
      .create({
        videoId: video.id,
        accountId: account.id,
        type: rate
      })
      .then(() => rateCounts += 1)

    tasks.push(p)
  }

  await Promise.all(tasks)

  logger.info('Adding %d %s to video %s.', rateCounts, rate, video.uuid)

  // This is "likes" and "dislikes"
  await video.increment(rate + 's', { by: rateCounts })

  return
}
