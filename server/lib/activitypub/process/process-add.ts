import * as Bluebird from 'bluebird'
import { VideoTorrentObject } from '../../../../shared'
import { ActivityAdd } from '../../../../shared/models/activitypub/activity'
import { retryTransactionWrapper } from '../../../helpers/database-utils'
import { logger } from '../../../helpers/logger'
import { database as db } from '../../../initializers'
import { AccountInstance } from '../../../models/account/account-interface'
import { VideoChannelInstance } from '../../../models/video/video-channel-interface'
import { getOrCreateAccount } from '../account'
import { getOrCreateVideoChannel } from '../video-channels'
import { generateThumbnailFromUrl } from '../videos'
import { videoActivityObjectToDBAttributes, videoFileActivityUrlToDBAttributes } from './misc'

async function processAddActivity (activity: ActivityAdd) {
  const activityObject = activity.object
  const activityType = activityObject.type
  const account = await getOrCreateAccount(activity.actor)

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

function processAddVideo (account: AccountInstance, activity: ActivityAdd, videoChannel: VideoChannelInstance, video: VideoTorrentObject) {
  const options = {
    arguments: [ account, activity, videoChannel, video ],
    errorMessage: 'Cannot insert the remote video with many retries.'
  }

  return retryTransactionWrapper(addRemoteVideo, options)
}

function addRemoteVideo (account: AccountInstance,
                         activity: ActivityAdd,
                         videoChannel: VideoChannelInstance,
                         videoToCreateData: VideoTorrentObject) {
  logger.debug('Adding remote video %s.', videoToCreateData.url)

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
