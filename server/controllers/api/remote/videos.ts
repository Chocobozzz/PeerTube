import * as express from 'express'
import * as Bluebird from 'bluebird'
import * as Sequelize from 'sequelize'

import { database as db } from '../../../initializers/database'
import {
  REQUEST_ENDPOINT_ACTIONS,
  REQUEST_ENDPOINTS,
  REQUEST_VIDEO_EVENT_TYPES,
  REQUEST_VIDEO_QADU_TYPES
} from '../../../initializers'
import {
  checkSignature,
  signatureValidator,
  remoteVideosValidator,
  remoteQaduVideosValidator,
  remoteEventsVideosValidator
} from '../../../middlewares'
import { logger, retryTransactionWrapper, resetSequelizeInstance } from '../../../helpers'
import { quickAndDirtyUpdatesVideoToFriends, fetchVideoChannelByHostAndUUID } from '../../../lib'
import { PodInstance, VideoFileInstance } from '../../../models'
import {
  RemoteVideoRequest,
  RemoteVideoCreateData,
  RemoteVideoUpdateData,
  RemoteVideoRemoveData,
  RemoteVideoReportAbuseData,
  RemoteQaduVideoRequest,
  RemoteQaduVideoData,
  RemoteVideoEventRequest,
  RemoteVideoEventData,
  RemoteVideoChannelCreateData,
  RemoteVideoChannelUpdateData,
  RemoteVideoChannelRemoveData,
  RemoteVideoAuthorRemoveData,
  RemoteVideoAuthorCreateData
} from '../../../../shared'
import { VideoInstance } from '../../../models/video/video-interface'

const ENDPOINT_ACTIONS = REQUEST_ENDPOINT_ACTIONS[REQUEST_ENDPOINTS.VIDEOS]

// Functions to call when processing a remote request
// FIXME: use RemoteVideoRequestType as id type
const functionsHash: { [ id: string ]: (...args) => Promise<any> } = {}
functionsHash[ENDPOINT_ACTIONS.ADD_VIDEO] = addRemoteVideoRetryWrapper
functionsHash[ENDPOINT_ACTIONS.UPDATE_VIDEO] = updateRemoteVideoRetryWrapper
functionsHash[ENDPOINT_ACTIONS.REMOVE_VIDEO] = removeRemoteVideoRetryWrapper
functionsHash[ENDPOINT_ACTIONS.ADD_CHANNEL] = addRemoteVideoChannelRetryWrapper
functionsHash[ENDPOINT_ACTIONS.UPDATE_CHANNEL] = updateRemoteVideoChannelRetryWrapper
functionsHash[ENDPOINT_ACTIONS.REMOVE_CHANNEL] = removeRemoteVideoChannelRetryWrapper
functionsHash[ENDPOINT_ACTIONS.REPORT_ABUSE] = reportAbuseRemoteVideoRetryWrapper
functionsHash[ENDPOINT_ACTIONS.ADD_AUTHOR] = addRemoteVideoAuthorRetryWrapper
functionsHash[ENDPOINT_ACTIONS.REMOVE_AUTHOR] = removeRemoteVideoAuthorRetryWrapper

const remoteVideosRouter = express.Router()

remoteVideosRouter.post('/',
  signatureValidator,
  checkSignature,
  remoteVideosValidator,
  remoteVideos
)

remoteVideosRouter.post('/qadu',
  signatureValidator,
  checkSignature,
  remoteQaduVideosValidator,
  remoteVideosQadu
)

remoteVideosRouter.post('/events',
  signatureValidator,
  checkSignature,
  remoteEventsVideosValidator,
  remoteVideosEvents
)

// ---------------------------------------------------------------------------

export {
  remoteVideosRouter
}

// ---------------------------------------------------------------------------

function remoteVideos (req: express.Request, res: express.Response, next: express.NextFunction) {
  const requests: RemoteVideoRequest[] = req.body.data
  const fromPod = res.locals.secure.pod

  // We need to process in the same order to keep consistency
  Bluebird.each(requests, request => {
    const data = request.data

    // Get the function we need to call in order to process the request
    const fun = functionsHash[request.type]
    if (fun === undefined) {
      logger.error('Unknown remote request type %s.', request.type)
      return
    }

    return fun.call(this, data, fromPod)
  })
  .catch(err => logger.error('Error managing remote videos.', err))

  // Don't block the other pod
  return res.type('json').status(204).end()
}

function remoteVideosQadu (req: express.Request, res: express.Response, next: express.NextFunction) {
  const requests: RemoteQaduVideoRequest[] = req.body.data
  const fromPod = res.locals.secure.pod

  Bluebird.each(requests, request => {
    const videoData = request.data

    return quickAndDirtyUpdateVideoRetryWrapper(videoData, fromPod)
  })
  .catch(err => logger.error('Error managing remote videos.', err))

  return res.type('json').status(204).end()
}

function remoteVideosEvents (req: express.Request, res: express.Response, next: express.NextFunction) {
  const requests: RemoteVideoEventRequest[] = req.body.data
  const fromPod = res.locals.secure.pod

  Bluebird.each(requests, request => {
    const eventData = request.data

    return processVideosEventsRetryWrapper(eventData, fromPod)
  })
  .catch(err => logger.error('Error managing remote videos.', err))

  return res.type('json').status(204).end()
}

async function processVideosEventsRetryWrapper (eventData: RemoteVideoEventData, fromPod: PodInstance) {
  const options = {
    arguments: [ eventData, fromPod ],
    errorMessage: 'Cannot process videos events with many retries.'
  }

  await retryTransactionWrapper(processVideosEvents, options)
}

async function processVideosEvents (eventData: RemoteVideoEventData, fromPod: PodInstance) {
  await db.sequelize.transaction(async t => {
    const sequelizeOptions = { transaction: t }
    const videoInstance = await fetchLocalVideoByUUID(eventData.uuid, t)

    let columnToUpdate
    let qaduType

    switch (eventData.eventType) {
    case REQUEST_VIDEO_EVENT_TYPES.VIEWS:
      columnToUpdate = 'views'
      qaduType = REQUEST_VIDEO_QADU_TYPES.VIEWS
      break

    case REQUEST_VIDEO_EVENT_TYPES.LIKES:
      columnToUpdate = 'likes'
      qaduType = REQUEST_VIDEO_QADU_TYPES.LIKES
      break

    case REQUEST_VIDEO_EVENT_TYPES.DISLIKES:
      columnToUpdate = 'dislikes'
      qaduType = REQUEST_VIDEO_QADU_TYPES.DISLIKES
      break

    default:
      throw new Error('Unknown video event type.')
    }

    const query = {}
    query[columnToUpdate] = eventData.count

    await videoInstance.increment(query, sequelizeOptions)

    const qadusParams = [
      {
        videoId: videoInstance.id,
        type: qaduType
      }
    ]
    await quickAndDirtyUpdatesVideoToFriends(qadusParams, t)
  })

  logger.info('Remote video event processed for video with uuid %s.', eventData.uuid)
}

async function quickAndDirtyUpdateVideoRetryWrapper (videoData: RemoteQaduVideoData, fromPod: PodInstance) {
  const options = {
    arguments: [ videoData, fromPod ],
    errorMessage: 'Cannot update quick and dirty the remote video with many retries.'
  }

  await retryTransactionWrapper(quickAndDirtyUpdateVideo, options)
}

async function quickAndDirtyUpdateVideo (videoData: RemoteQaduVideoData, fromPod: PodInstance) {
  let videoUUID = ''

  await db.sequelize.transaction(async t => {
    const videoInstance = await fetchVideoByHostAndUUID(fromPod.host, videoData.uuid, t)
    const sequelizeOptions = { transaction: t }

    videoUUID = videoInstance.uuid

    if (videoData.views) {
      videoInstance.set('views', videoData.views)
    }

    if (videoData.likes) {
      videoInstance.set('likes', videoData.likes)
    }

    if (videoData.dislikes) {
      videoInstance.set('dislikes', videoData.dislikes)
    }

    await videoInstance.save(sequelizeOptions)
  })

  logger.info('Remote video with uuid %s quick and dirty updated', videoUUID)
}

// Handle retries on fail
async function addRemoteVideoRetryWrapper (videoToCreateData: RemoteVideoCreateData, fromPod: PodInstance) {
  const options = {
    arguments: [ videoToCreateData, fromPod ],
    errorMessage: 'Cannot insert the remote video with many retries.'
  }

  await retryTransactionWrapper(addRemoteVideo, options)
}

async function addRemoteVideo (videoToCreateData: RemoteVideoCreateData, fromPod: PodInstance) {
  logger.debug('Adding remote video "%s".', videoToCreateData.uuid)

  await db.sequelize.transaction(async t => {
    const sequelizeOptions = {
      transaction: t
    }

    const videoFromDatabase = await db.Video.loadByUUID(videoToCreateData.uuid)
    if (videoFromDatabase) throw new Error('UUID already exists.')

    const videoChannel = await db.VideoChannel.loadByHostAndUUID(fromPod.host, videoToCreateData.channelUUID, t)
    if (!videoChannel) throw new Error('Video channel ' + videoToCreateData.channelUUID + ' not found.')

    const tags = videoToCreateData.tags
    const tagInstances = await db.Tag.findOrCreateTags(tags, t)

    const videoData = {
      name: videoToCreateData.name,
      uuid: videoToCreateData.uuid,
      category: videoToCreateData.category,
      licence: videoToCreateData.licence,
      language: videoToCreateData.language,
      nsfw: videoToCreateData.nsfw,
      description: videoToCreateData.truncatedDescription,
      channelId: videoChannel.id,
      duration: videoToCreateData.duration,
      createdAt: videoToCreateData.createdAt,
      // FIXME: updatedAt does not seems to be considered by Sequelize
      updatedAt: videoToCreateData.updatedAt,
      views: videoToCreateData.views,
      likes: videoToCreateData.likes,
      dislikes: videoToCreateData.dislikes,
      remote: true,
      privacy: videoToCreateData.privacy
    }

    const video = db.Video.build(videoData)
    await db.Video.generateThumbnailFromData(video, videoToCreateData.thumbnailData)
    const videoCreated = await video.save(sequelizeOptions)

    const tasks = []
    for (const fileData of videoToCreateData.files) {
      const videoFileInstance = db.VideoFile.build({
        extname: fileData.extname,
        infoHash: fileData.infoHash,
        resolution: fileData.resolution,
        size: fileData.size,
        videoId: videoCreated.id
      })

      tasks.push(videoFileInstance.save(sequelizeOptions))
    }

    await Promise.all(tasks)

    await videoCreated.setTags(tagInstances, sequelizeOptions)
  })

  logger.info('Remote video with uuid %s inserted.', videoToCreateData.uuid)
}

// Handle retries on fail
async function updateRemoteVideoRetryWrapper (videoAttributesToUpdate: RemoteVideoUpdateData, fromPod: PodInstance) {
  const options = {
    arguments: [ videoAttributesToUpdate, fromPod ],
    errorMessage: 'Cannot update the remote video with many retries'
  }

  await retryTransactionWrapper(updateRemoteVideo, options)
}

async function updateRemoteVideo (videoAttributesToUpdate: RemoteVideoUpdateData, fromPod: PodInstance) {
  logger.debug('Updating remote video "%s".', videoAttributesToUpdate.uuid)
  let videoInstance: VideoInstance
  let videoFieldsSave: object

  try {
    await db.sequelize.transaction(async t => {
      const sequelizeOptions = {
        transaction: t
      }

      const videoInstance = await fetchVideoByHostAndUUID(fromPod.host, videoAttributesToUpdate.uuid, t)
      videoFieldsSave = videoInstance.toJSON()
      const tags = videoAttributesToUpdate.tags

      const tagInstances = await db.Tag.findOrCreateTags(tags, t)

      videoInstance.set('name', videoAttributesToUpdate.name)
      videoInstance.set('category', videoAttributesToUpdate.category)
      videoInstance.set('licence', videoAttributesToUpdate.licence)
      videoInstance.set('language', videoAttributesToUpdate.language)
      videoInstance.set('nsfw', videoAttributesToUpdate.nsfw)
      videoInstance.set('description', videoAttributesToUpdate.truncatedDescription)
      videoInstance.set('duration', videoAttributesToUpdate.duration)
      videoInstance.set('createdAt', videoAttributesToUpdate.createdAt)
      videoInstance.set('updatedAt', videoAttributesToUpdate.updatedAt)
      videoInstance.set('views', videoAttributesToUpdate.views)
      videoInstance.set('likes', videoAttributesToUpdate.likes)
      videoInstance.set('dislikes', videoAttributesToUpdate.dislikes)
      videoInstance.set('privacy', videoAttributesToUpdate.privacy)

      await videoInstance.save(sequelizeOptions)

      // Remove old video files
      const videoFileDestroyTasks: Bluebird<void>[] = []
      for (const videoFile of videoInstance.VideoFiles) {
        videoFileDestroyTasks.push(videoFile.destroy(sequelizeOptions))
      }
      await Promise.all(videoFileDestroyTasks)

      const videoFileCreateTasks: Bluebird<VideoFileInstance>[] = []
      for (const fileData of videoAttributesToUpdate.files) {
        const videoFileInstance = db.VideoFile.build({
          extname: fileData.extname,
          infoHash: fileData.infoHash,
          resolution: fileData.resolution,
          size: fileData.size,
          videoId: videoInstance.id
        })

        videoFileCreateTasks.push(videoFileInstance.save(sequelizeOptions))
      }

      await Promise.all(videoFileCreateTasks)

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

async function removeRemoteVideoRetryWrapper (videoToRemoveData: RemoteVideoRemoveData, fromPod: PodInstance) {
  const options = {
    arguments: [ videoToRemoveData, fromPod ],
    errorMessage: 'Cannot remove the remote video channel with many retries.'
  }

  await retryTransactionWrapper(removeRemoteVideo, options)
}

async function removeRemoteVideo (videoToRemoveData: RemoteVideoRemoveData, fromPod: PodInstance) {
  logger.debug('Removing remote video "%s".', videoToRemoveData.uuid)

  await db.sequelize.transaction(async t => {
    // We need the instance because we have to remove some other stuffs (thumbnail etc)
    const videoInstance = await fetchVideoByHostAndUUID(fromPod.host, videoToRemoveData.uuid, t)
    await videoInstance.destroy({ transaction: t })
  })

  logger.info('Remote video with uuid %s removed.', videoToRemoveData.uuid)
}

async function addRemoteVideoAuthorRetryWrapper (authorToCreateData: RemoteVideoAuthorCreateData, fromPod: PodInstance) {
  const options = {
    arguments: [ authorToCreateData, fromPod ],
    errorMessage: 'Cannot insert the remote video author with many retries.'
  }

  await retryTransactionWrapper(addRemoteVideoAuthor, options)
}

async function addRemoteVideoAuthor (authorToCreateData: RemoteVideoAuthorCreateData, fromPod: PodInstance) {
  logger.debug('Adding remote video author "%s".', authorToCreateData.uuid)

  await db.sequelize.transaction(async t => {
    const authorInDatabase = await db.Author.loadAuthorByPodAndUUID(authorToCreateData.uuid, fromPod.id, t)
    if (authorInDatabase) throw new Error('Author with UUID ' + authorToCreateData.uuid + ' already exists.')

    const videoAuthorData = {
      name: authorToCreateData.name,
      uuid: authorToCreateData.uuid,
      userId: null, // Not on our pod
      podId: fromPod.id
    }

    const author = db.Author.build(videoAuthorData)
    await author.save({ transaction: t })
  })

  logger.info('Remote video author with uuid %s inserted.', authorToCreateData.uuid)
}

async function removeRemoteVideoAuthorRetryWrapper (authorAttributesToRemove: RemoteVideoAuthorRemoveData, fromPod: PodInstance) {
  const options = {
    arguments: [ authorAttributesToRemove, fromPod ],
    errorMessage: 'Cannot remove the remote video author with many retries.'
  }

  await retryTransactionWrapper(removeRemoteVideoAuthor, options)
}

async function removeRemoteVideoAuthor (authorAttributesToRemove: RemoteVideoAuthorRemoveData, fromPod: PodInstance) {
  logger.debug('Removing remote video author "%s".', authorAttributesToRemove.uuid)

  await db.sequelize.transaction(async t => {
    const videoAuthor = await db.Author.loadAuthorByPodAndUUID(authorAttributesToRemove.uuid, fromPod.id, t)
    await videoAuthor.destroy({ transaction: t })
  })

  logger.info('Remote video author with uuid %s removed.', authorAttributesToRemove.uuid)
}

async function addRemoteVideoChannelRetryWrapper (videoChannelToCreateData: RemoteVideoChannelCreateData, fromPod: PodInstance) {
  const options = {
    arguments: [ videoChannelToCreateData, fromPod ],
    errorMessage: 'Cannot insert the remote video channel with many retries.'
  }

  await retryTransactionWrapper(addRemoteVideoChannel, options)
}

async function addRemoteVideoChannel (videoChannelToCreateData: RemoteVideoChannelCreateData, fromPod: PodInstance) {
  logger.debug('Adding remote video channel "%s".', videoChannelToCreateData.uuid)

  await db.sequelize.transaction(async t => {
    const videoChannelInDatabase = await db.VideoChannel.loadByUUID(videoChannelToCreateData.uuid)
    if (videoChannelInDatabase) {
      throw new Error('Video channel with UUID ' + videoChannelToCreateData.uuid + ' already exists.')
    }

    const authorUUID = videoChannelToCreateData.ownerUUID
    const podId = fromPod.id

    const author = await db.Author.loadAuthorByPodAndUUID(authorUUID, podId, t)
    if (!author) throw new Error('Unknown author UUID' + authorUUID + '.')

    const videoChannelData = {
      name: videoChannelToCreateData.name,
      description: videoChannelToCreateData.description,
      uuid: videoChannelToCreateData.uuid,
      createdAt: videoChannelToCreateData.createdAt,
      updatedAt: videoChannelToCreateData.updatedAt,
      remote: true,
      authorId: author.id
    }

    const videoChannel = db.VideoChannel.build(videoChannelData)
    await videoChannel.save({ transaction: t })
  })

  logger.info('Remote video channel with uuid %s inserted.', videoChannelToCreateData.uuid)
}

async function updateRemoteVideoChannelRetryWrapper (videoChannelAttributesToUpdate: RemoteVideoChannelUpdateData, fromPod: PodInstance) {
  const options = {
    arguments: [ videoChannelAttributesToUpdate, fromPod ],
    errorMessage: 'Cannot update the remote video channel with many retries.'
  }

  await retryTransactionWrapper(updateRemoteVideoChannel, options)
}

async function updateRemoteVideoChannel (videoChannelAttributesToUpdate: RemoteVideoChannelUpdateData, fromPod: PodInstance) {
  logger.debug('Updating remote video channel "%s".', videoChannelAttributesToUpdate.uuid)

  await db.sequelize.transaction(async t => {
    const sequelizeOptions = { transaction: t }

    const videoChannelInstance = await fetchVideoChannelByHostAndUUID(fromPod.host, videoChannelAttributesToUpdate.uuid, t)
    videoChannelInstance.set('name', videoChannelAttributesToUpdate.name)
    videoChannelInstance.set('description', videoChannelAttributesToUpdate.description)
    videoChannelInstance.set('createdAt', videoChannelAttributesToUpdate.createdAt)
    videoChannelInstance.set('updatedAt', videoChannelAttributesToUpdate.updatedAt)

    await videoChannelInstance.save(sequelizeOptions)
  })

  logger.info('Remote video channel with uuid %s updated', videoChannelAttributesToUpdate.uuid)
}

async function removeRemoteVideoChannelRetryWrapper (videoChannelAttributesToRemove: RemoteVideoChannelRemoveData, fromPod: PodInstance) {
  const options = {
    arguments: [ videoChannelAttributesToRemove, fromPod ],
    errorMessage: 'Cannot remove the remote video channel with many retries.'
  }

  await retryTransactionWrapper(removeRemoteVideoChannel, options)
}

async function removeRemoteVideoChannel (videoChannelAttributesToRemove: RemoteVideoChannelRemoveData, fromPod: PodInstance) {
  logger.debug('Removing remote video channel "%s".', videoChannelAttributesToRemove.uuid)

  await db.sequelize.transaction(async t => {
    const videoChannel = await fetchVideoChannelByHostAndUUID(fromPod.host, videoChannelAttributesToRemove.uuid, t)
    await videoChannel.destroy({ transaction: t })
  })

  logger.info('Remote video channel with uuid %s removed.', videoChannelAttributesToRemove.uuid)
}

async function reportAbuseRemoteVideoRetryWrapper (reportData: RemoteVideoReportAbuseData, fromPod: PodInstance) {
  const options = {
    arguments: [ reportData, fromPod ],
    errorMessage: 'Cannot create remote abuse video with many retries.'
  }

  await retryTransactionWrapper(reportAbuseRemoteVideo, options)
}

async function reportAbuseRemoteVideo (reportData: RemoteVideoReportAbuseData, fromPod: PodInstance) {
  logger.debug('Reporting remote abuse for video %s.', reportData.videoUUID)

  await db.sequelize.transaction(async t => {
    const videoInstance = await fetchLocalVideoByUUID(reportData.videoUUID, t)
    const videoAbuseData = {
      reporterUsername: reportData.reporterUsername,
      reason: reportData.reportReason,
      reporterPodId: fromPod.id,
      videoId: videoInstance.id
    }

    await db.VideoAbuse.create(videoAbuseData)

  })

  logger.info('Remote abuse for video uuid %s created', reportData.videoUUID)
}

async function fetchLocalVideoByUUID (id: string, t: Sequelize.Transaction) {
  try {
    const video = await db.Video.loadLocalVideoByUUID(id, t)

    if (!video) throw new Error('Video ' + id + ' not found')

    return video
  } catch (err) {
    logger.error('Cannot load owned video from id.', { error: err.stack, id })
    throw err
  }
}

async function fetchVideoByHostAndUUID (podHost: string, uuid: string, t: Sequelize.Transaction) {
  try {
    const video = await db.Video.loadByHostAndUUID(podHost, uuid, t)
    if (!video) throw new Error('Video not found')

    return video
  } catch (err) {
    logger.error('Cannot load video from host and uuid.', { error: err.stack, podHost, uuid })
    throw err
  }
}
