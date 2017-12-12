import * as Bluebird from 'bluebird'
import { VideoChannelObject, VideoTorrentObject } from '../../../../shared'
import { ActivityUpdate } from '../../../../shared/models/activitypub'
import { logger, resetSequelizeInstance, retryTransactionWrapper } from '../../../helpers'
import { sequelizeTypescript } from '../../../initializers'
import { AccountModel } from '../../../models/account/account'
import { TagModel } from '../../../models/video/tag'
import { VideoModel } from '../../../models/video/video'
import { VideoChannelModel } from '../../../models/video/video-channel'
import { VideoFileModel } from '../../../models/video/video-file'
import { getOrCreateAccountAndServer } from '../account'
import { videoActivityObjectToDBAttributes, videoFileActivityUrlToDBAttributes } from './misc'

async function processUpdateActivity (activity: ActivityUpdate) {
  const account = await getOrCreateAccountAndServer(activity.actor)

  if (activity.object.type === 'Video') {
    return processUpdateVideo(account, activity.object)
  } else if (activity.object.type === 'VideoChannel') {
    return processUpdateVideoChannel(account, activity.object)
  }

  return
}

// ---------------------------------------------------------------------------

export {
  processUpdateActivity
}

// ---------------------------------------------------------------------------

function processUpdateVideo (account: AccountModel, video: VideoTorrentObject) {
  const options = {
    arguments: [ account, video ],
    errorMessage: 'Cannot update the remote video with many retries'
  }

  return retryTransactionWrapper(updateRemoteVideo, options)
}

async function updateRemoteVideo (account: AccountModel, videoAttributesToUpdate: VideoTorrentObject) {
  logger.debug('Updating remote video "%s".', videoAttributesToUpdate.uuid)
  let videoInstance: VideoModel
  let videoFieldsSave: object

  try {
    await sequelizeTypescript.transaction(async t => {
      const sequelizeOptions = {
        transaction: t
      }

      const videoInstance = await VideoModel.loadByUrlAndPopulateAccount(videoAttributesToUpdate.id, t)
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
      const tasks: Bluebird<any>[] = videoFileAttributes.map(f => VideoFileModel.create(f))
      await Promise.all(tasks)

      const tags = videoAttributesToUpdate.tag.map(t => t.name)
      const tagInstances = await TagModel.findOrCreateTags(tags, t)
      await videoInstance.$set('Tags', tagInstances, sequelizeOptions)
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

async function processUpdateVideoChannel (account: AccountModel, videoChannel: VideoChannelObject) {
  const options = {
    arguments: [ account, videoChannel ],
    errorMessage: 'Cannot update the remote video channel with many retries.'
  }

  await retryTransactionWrapper(updateRemoteVideoChannel, options)
}

async function updateRemoteVideoChannel (account: AccountModel, videoChannel: VideoChannelObject) {
  logger.debug('Updating remote video channel "%s".', videoChannel.uuid)

  await sequelizeTypescript.transaction(async t => {
    const sequelizeOptions = { transaction: t }

    const videoChannelInstance = await VideoChannelModel.loadByUrl(videoChannel.id)
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
