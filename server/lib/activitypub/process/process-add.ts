import * as Bluebird from 'bluebird'
import { VideoTorrentObject } from '../../../../shared'
import { ActivityAdd } from '../../../../shared/models/activitypub/activity'
import { VideoRateType } from '../../../../shared/models/videos/video-rate.type'
import { retryTransactionWrapper } from '../../../helpers/database-utils'
import { logger } from '../../../helpers/logger'
import { database as db } from '../../../initializers'
import { AccountInstance } from '../../../models/account/account-interface'
import { VideoChannelInstance } from '../../../models/video/video-channel-interface'
import { VideoInstance } from '../../../models/video/video-interface'
import { getOrCreateAccountAndServer } from '../account'
import { getOrCreateVideoChannel } from '../video-channels'
import { generateThumbnailFromUrl } from '../videos'
import { videoActivityObjectToDBAttributes, videoFileActivityUrlToDBAttributes } from './misc'

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

async function processAddVideo (
  account: AccountInstance,
  activity: ActivityAdd,
  videoChannel: VideoChannelInstance,
  videoToCreateData: VideoTorrentObject
) {
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

  return video
}

function addRemoteVideo (account: AccountInstance,
                         activity: ActivityAdd,
                         videoChannel: VideoChannelInstance,
                         videoToCreateData: VideoTorrentObject) {
  logger.debug('Adding remote video %s.', videoToCreateData.id)

  return db.sequelize.transaction(async t => {
    const sequelizeOptions = {
      transaction: t
    }

    if (videoChannel.Account.id !== account.id) throw new Error('Video channel is not owned by this account.')

    const videoFromDatabase = await db.Video.loadByUUIDOrURL(videoToCreateData.uuid, videoToCreateData.id, t)
    if (videoFromDatabase) throw new Error('Video with this UUID/Url already exists.')

    const videoData = await videoActivityObjectToDBAttributes(videoChannel, videoToCreateData, activity.to, activity.cc)
    const video = db.Video.build(videoData)

    // Don't block on request
    generateThumbnailFromUrl(video, videoToCreateData.icon)
      .catch(err => logger.warn('Cannot generate thumbnail of %s.', videoToCreateData.id, err))

    const videoCreated = await video.save(sequelizeOptions)

    const videoFileAttributes = videoFileActivityUrlToDBAttributes(videoCreated, videoToCreateData)
    if (videoFileAttributes.length === 0) {
      throw new Error('Cannot find valid files for video %s ' + videoToCreateData.url)
    }

    const tasks: Bluebird<any>[] = videoFileAttributes.map(f => db.VideoFile.create(f, { transaction: t }))
    await Promise.all(tasks)

    const tags = videoToCreateData.tag.map(t => t.name)
    const tagInstances = await db.Tag.findOrCreateTags(tags, t)
    await videoCreated.setTags(tagInstances, sequelizeOptions)

    logger.info('Remote video with uuid %s inserted.', videoToCreateData.uuid)

    return videoCreated
  })
}

async function createRates (accountUrls: string[], video: VideoInstance, rate: VideoRateType) {
  let rateCounts = 0
  const tasks: Bluebird<any>[] = []

  for (const accountUrl of accountUrls) {
    const account = await getOrCreateAccountAndServer(accountUrl)
    const p = db.AccountVideoRate
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
