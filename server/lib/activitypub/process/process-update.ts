import { VideoChannelObject, VideoTorrentObject } from '../../../../shared'
import { ActivityUpdate } from '../../../../shared/models/activitypub/activity'
import { getOrCreateAccount } from '../../../helpers/activitypub'
import { retryTransactionWrapper } from '../../../helpers/database-utils'
import { logger } from '../../../helpers/logger'
import { resetSequelizeInstance } from '../../../helpers/utils'
import { database as db } from '../../../initializers'
import { AccountInstance } from '../../../models/account/account-interface'
import { VideoInstance } from '../../../models/video/video-interface'
import { videoActivityObjectToDBAttributes, videoFileActivityUrlToDBAttributes } from './misc'
import Bluebird = require('bluebird')

async function processUpdateActivity (activity: ActivityUpdate) {
  const account = await getOrCreateAccount(activity.actor)

  if (activity.object.type === 'Video') {
    return processUpdateVideo(account, activity.object)
  } else if (activity.object.type === 'VideoChannel') {
    return processUpdateVideoChannel(account, activity.object)
  }

  return undefined
}

// ---------------------------------------------------------------------------

export {
  processUpdateActivity
}

// ---------------------------------------------------------------------------

function processUpdateVideo (account: AccountInstance, video: VideoTorrentObject) {
  const options = {
    arguments: [ account, video ],
    errorMessage: 'Cannot update the remote video with many retries'
  }

  return retryTransactionWrapper(updateRemoteVideo, options)
}

async function updateRemoteVideo (account: AccountInstance, videoAttributesToUpdate: VideoTorrentObject) {
  logger.debug('Updating remote video "%s".', videoAttributesToUpdate.uuid)
  let videoInstance: VideoInstance
  let videoFieldsSave: object

  try {
    await db.sequelize.transaction(async t => {
      const sequelizeOptions = {
        transaction: t
      }

      const videoInstance = await db.Video.loadByUrlAndPopulateAccount(videoAttributesToUpdate.id, t)
      if (!videoInstance) throw new Error('Video ' + videoAttributesToUpdate.id + ' not found.')

      if (videoInstance.VideoChannel.Account.id !== account.id) {
        throw new Error('Account ' + account.url + ' does not own video channel ' + videoInstance.VideoChannel.url)
      }

      const videoData = await videoActivityObjectToDBAttributes(videoInstance.VideoChannel, videoAttributesToUpdate)
      videoInstance.set('name', videoData.name)
      videoInstance.set('category', videoData.category)
      videoInstance.set('licence', videoData.licence)
      videoInstance.set('language', videoData.language)
      videoInstance.set('nsfw', videoData.nsfw)
      videoInstance.set('description', videoData.description)
      videoInstance.set('duration', videoData.duration)
      videoInstance.set('createdAt', videoData.createdAt)
      videoInstance.set('updatedAt', videoData.updatedAt)
      videoInstance.set('views', videoData.views)
      // videoInstance.set('likes', videoData.likes)
      // videoInstance.set('dislikes', videoData.dislikes)

      await videoInstance.save(sequelizeOptions)

      // Remove old video files
      const videoFileDestroyTasks: Bluebird<void>[] = []
      for (const videoFile of videoInstance.VideoFiles) {
        videoFileDestroyTasks.push(videoFile.destroy(sequelizeOptions))
      }
      await Promise.all(videoFileDestroyTasks)

      const videoFileAttributes = videoFileActivityUrlToDBAttributes(videoInstance, videoAttributesToUpdate)
      const tasks: Bluebird<any>[] = videoFileAttributes.map(f => db.VideoFile.create(f))
      await Promise.all(tasks)

      const tags = videoAttributesToUpdate.tag.map(t => t.name)
      const tagInstances = await db.Tag.findOrCreateTags(tags, t)
      await videoInstance.setTags(tagInstances, sequelizeOptions)
    })

    logger.info('Remote video with uuid %s updated', videoAttributesToUpdate.uuid)
  } catch (err) {
    if (videoInstance !== undefined && videoFieldsSave !== undefined) {
      resetSequelizeInstance(videoInstance, videoFieldsSave)
    }

    // This is just a debug because we will retry the insert
    logger.debug('Cannot update the remote video.', err)
    throw err
  }
}

async function processUpdateVideoChannel (account: AccountInstance, videoChannel: VideoChannelObject) {
  const options = {
    arguments: [ account, videoChannel ],
    errorMessage: 'Cannot update the remote video channel with many retries.'
  }

  await retryTransactionWrapper(updateRemoteVideoChannel, options)
}

async function updateRemoteVideoChannel (account: AccountInstance, videoChannel: VideoChannelObject) {
  logger.debug('Updating remote video channel "%s".', videoChannel.uuid)

  await db.sequelize.transaction(async t => {
    const sequelizeOptions = { transaction: t }

    const videoChannelInstance = await db.VideoChannel.loadByUrl(videoChannel.id)
    if (!videoChannelInstance) throw new Error('Video ' + videoChannel.id + ' not found.')

    if (videoChannelInstance.Account.id !== account.id) {
      throw new Error('Account ' + account.id + ' does not own video channel ' + videoChannelInstance.url)
    }

    videoChannelInstance.set('name', videoChannel.name)
    videoChannelInstance.set('description', videoChannel.content)
    videoChannelInstance.set('createdAt', videoChannel.published)
    videoChannelInstance.set('updatedAt', videoChannel.updated)

    await videoChannelInstance.save(sequelizeOptions)
  })

  logger.info('Remote video channel with uuid %s updated', videoChannel.uuid)
}
