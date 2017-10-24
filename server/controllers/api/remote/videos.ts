import * as express from 'express'
import * as Promise from 'bluebird'
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
import { logger, retryTransactionWrapper } from '../../../helpers'
import { quickAndDirtyUpdatesVideoToFriends } from '../../../lib'
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
  Promise.each(requests, request => {
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

  Promise.each(requests, request => {
    const videoData = request.data

    return quickAndDirtyUpdateVideoRetryWrapper(videoData, fromPod)
  })
  .catch(err => logger.error('Error managing remote videos.', err))

  return res.type('json').status(204).end()
}

function remoteVideosEvents (req: express.Request, res: express.Response, next: express.NextFunction) {
  const requests: RemoteVideoEventRequest[] = req.body.data
  const fromPod = res.locals.secure.pod

  Promise.each(requests, request => {
    const eventData = request.data

    return processVideosEventsRetryWrapper(eventData, fromPod)
  })
  .catch(err => logger.error('Error managing remote videos.', err))

  return res.type('json').status(204).end()
}

function processVideosEventsRetryWrapper (eventData: RemoteVideoEventData, fromPod: PodInstance) {
  const options = {
    arguments: [ eventData, fromPod ],
    errorMessage: 'Cannot process videos events with many retries.'
  }

  return retryTransactionWrapper(processVideosEvents, options)
}

function processVideosEvents (eventData: RemoteVideoEventData, fromPod: PodInstance) {

  return db.sequelize.transaction(t => {
    return fetchVideoByUUID(eventData.uuid, t)
      .then(videoInstance => {
        const options = { transaction: t }

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

        return videoInstance.increment(query, options).then(() => ({ videoInstance, qaduType }))
      })
      .then(({ videoInstance, qaduType }) => {
        const qadusParams = [
          {
            videoId: videoInstance.id,
            type: qaduType
          }
        ]

        return quickAndDirtyUpdatesVideoToFriends(qadusParams, t)
      })
  })
  .then(() => logger.info('Remote video event processed for video with uuid %s.', eventData.uuid))
  .catch(err => {
    logger.debug('Cannot process a video event.', err)
    throw err
  })
}

function quickAndDirtyUpdateVideoRetryWrapper (videoData: RemoteQaduVideoData, fromPod: PodInstance) {
  const options = {
    arguments: [ videoData, fromPod ],
    errorMessage: 'Cannot update quick and dirty the remote video with many retries.'
  }

  return retryTransactionWrapper(quickAndDirtyUpdateVideo, options)
}

function quickAndDirtyUpdateVideo (videoData: RemoteQaduVideoData, fromPod: PodInstance) {
  let videoUUID = ''

  return db.sequelize.transaction(t => {
    return fetchVideoByHostAndUUID(fromPod.host, videoData.uuid, t)
      .then(videoInstance => {
        const options = { transaction: t }

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

        return videoInstance.save(options)
      })
  })
  .then(() => logger.info('Remote video with uuid %s quick and dirty updated', videoUUID))
  .catch(err => logger.debug('Cannot quick and dirty update the remote video.', err))
}

// Handle retries on fail
function addRemoteVideoRetryWrapper (videoToCreateData: RemoteVideoCreateData, fromPod: PodInstance) {
  const options = {
    arguments: [ videoToCreateData, fromPod ],
    errorMessage: 'Cannot insert the remote video with many retries.'
  }

  return retryTransactionWrapper(addRemoteVideo, options)
}

function addRemoteVideo (videoToCreateData: RemoteVideoCreateData, fromPod: PodInstance) {
  logger.debug('Adding remote video "%s".', videoToCreateData.uuid)

  return db.sequelize.transaction(t => {
    return db.Video.loadByUUID(videoToCreateData.uuid)
      .then(video => {
        if (video) throw new Error('UUID already exists.')

        return db.VideoChannel.loadByHostAndUUID(fromPod.host, videoToCreateData.channelUUID, t)
      })
      .then(videoChannel => {
        if (!videoChannel) throw new Error('Video channel ' + videoToCreateData.channelUUID + ' not found.')

        const tags = videoToCreateData.tags

        return db.Tag.findOrCreateTags(tags, t).then(tagInstances => ({ videoChannel, tagInstances }))
      })
      .then(({ videoChannel, tagInstances }) => {
        const videoData = {
          name: videoToCreateData.name,
          uuid: videoToCreateData.uuid,
          category: videoToCreateData.category,
          licence: videoToCreateData.licence,
          language: videoToCreateData.language,
          nsfw: videoToCreateData.nsfw,
          description: videoToCreateData.description,
          channelId: videoChannel.id,
          duration: videoToCreateData.duration,
          createdAt: videoToCreateData.createdAt,
          // FIXME: updatedAt does not seems to be considered by Sequelize
          updatedAt: videoToCreateData.updatedAt,
          views: videoToCreateData.views,
          likes: videoToCreateData.likes,
          dislikes: videoToCreateData.dislikes,
          remote: true
        }

        const video = db.Video.build(videoData)
        return { tagInstances, video }
      })
      .then(({ tagInstances, video }) => {
        return db.Video.generateThumbnailFromData(video, videoToCreateData.thumbnailData).then(() => ({ tagInstances, video }))
      })
      .then(({ tagInstances, video }) => {
        const options = {
          transaction: t
        }

        return video.save(options).then(videoCreated => ({ tagInstances, videoCreated }))
      })
      .then(({ tagInstances, videoCreated }) => {
        const tasks = []
        const options = {
          transaction: t
        }

        videoToCreateData.files.forEach(fileData => {
          const videoFileInstance = db.VideoFile.build({
            extname: fileData.extname,
            infoHash: fileData.infoHash,
            resolution: fileData.resolution,
            size: fileData.size,
            videoId: videoCreated.id
          })

          tasks.push(videoFileInstance.save(options))
        })

        return Promise.all(tasks).then(() => ({ tagInstances, videoCreated }))
      })
      .then(({ tagInstances, videoCreated }) => {
        const options = {
          transaction: t
        }

        return videoCreated.setTags(tagInstances, options)
      })
  })
  .then(() => logger.info('Remote video with uuid %s inserted.', videoToCreateData.uuid))
  .catch(err => {
    logger.debug('Cannot insert the remote video.', err)
    throw err
  })
}

// Handle retries on fail
function updateRemoteVideoRetryWrapper (videoAttributesToUpdate: RemoteVideoUpdateData, fromPod: PodInstance) {
  const options = {
    arguments: [ videoAttributesToUpdate, fromPod ],
    errorMessage: 'Cannot update the remote video with many retries'
  }

  return retryTransactionWrapper(updateRemoteVideo, options)
}

function updateRemoteVideo (videoAttributesToUpdate: RemoteVideoUpdateData, fromPod: PodInstance) {
  logger.debug('Updating remote video "%s".', videoAttributesToUpdate.uuid)

  return db.sequelize.transaction(t => {
    return fetchVideoByHostAndUUID(fromPod.host, videoAttributesToUpdate.uuid, t)
      .then(videoInstance => {
        const tags = videoAttributesToUpdate.tags

        return db.Tag.findOrCreateTags(tags, t).then(tagInstances => ({ videoInstance, tagInstances }))
      })
      .then(({ videoInstance, tagInstances }) => {
        const options = { transaction: t }

        videoInstance.set('name', videoAttributesToUpdate.name)
        videoInstance.set('category', videoAttributesToUpdate.category)
        videoInstance.set('licence', videoAttributesToUpdate.licence)
        videoInstance.set('language', videoAttributesToUpdate.language)
        videoInstance.set('nsfw', videoAttributesToUpdate.nsfw)
        videoInstance.set('description', videoAttributesToUpdate.description)
        videoInstance.set('duration', videoAttributesToUpdate.duration)
        videoInstance.set('createdAt', videoAttributesToUpdate.createdAt)
        videoInstance.set('updatedAt', videoAttributesToUpdate.updatedAt)
        videoInstance.set('views', videoAttributesToUpdate.views)
        videoInstance.set('likes', videoAttributesToUpdate.likes)
        videoInstance.set('dislikes', videoAttributesToUpdate.dislikes)

        return videoInstance.save(options).then(() => ({ videoInstance, tagInstances }))
      })
      .then(({ tagInstances, videoInstance }) => {
        const tasks: Promise<void>[] = []

        // Remove old video files
        videoInstance.VideoFiles.forEach(videoFile => {
          tasks.push(videoFile.destroy({ transaction: t }))
        })

        return Promise.all(tasks).then(() => ({ tagInstances, videoInstance }))
      })
      .then(({ tagInstances, videoInstance }) => {
        const tasks: Promise<VideoFileInstance>[] = []
        const options = {
          transaction: t
        }

        videoAttributesToUpdate.files.forEach(fileData => {
          const videoFileInstance = db.VideoFile.build({
            extname: fileData.extname,
            infoHash: fileData.infoHash,
            resolution: fileData.resolution,
            size: fileData.size,
            videoId: videoInstance.id
          })

          tasks.push(videoFileInstance.save(options))
        })

        return Promise.all(tasks).then(() => ({ tagInstances, videoInstance }))
      })
      .then(({ videoInstance, tagInstances }) => {
        const options = { transaction: t }

        return videoInstance.setTags(tagInstances, options)
      })
  })
  .then(() => logger.info('Remote video with uuid %s updated', videoAttributesToUpdate.uuid))
  .catch(err => {
    // This is just a debug because we will retry the insert
    logger.debug('Cannot update the remote video.', err)
    throw err
  })
}

function removeRemoteVideoRetryWrapper (videoToRemoveData: RemoteVideoRemoveData, fromPod: PodInstance) {
  const options = {
    arguments: [ videoToRemoveData, fromPod ],
    errorMessage: 'Cannot remove the remote video channel with many retries.'
  }

  return retryTransactionWrapper(removeRemoteVideo, options)
}

function removeRemoteVideo (videoToRemoveData: RemoteVideoRemoveData, fromPod: PodInstance) {
  logger.debug('Removing remote video "%s".', videoToRemoveData.uuid)

  return db.sequelize.transaction(t => {
    // We need the instance because we have to remove some other stuffs (thumbnail etc)
    return fetchVideoByHostAndUUID(fromPod.host, videoToRemoveData.uuid, t)
      .then(video => video.destroy({ transaction: t }))
  })
  .then(() => logger.info('Remote video with uuid %s removed.', videoToRemoveData.uuid))
  .catch(err => {
    logger.debug('Cannot remove the remote video.', err)
    throw err
  })
}

function addRemoteVideoAuthorRetryWrapper (authorToCreateData: RemoteVideoAuthorCreateData, fromPod: PodInstance) {
  const options = {
    arguments: [ authorToCreateData, fromPod ],
    errorMessage: 'Cannot insert the remote video author with many retries.'
  }

  return retryTransactionWrapper(addRemoteVideoAuthor, options)
}

function addRemoteVideoAuthor (authorToCreateData: RemoteVideoAuthorCreateData, fromPod: PodInstance) {
  logger.debug('Adding remote video author "%s".', authorToCreateData.uuid)

  return db.sequelize.transaction(t => {
    return db.Author.loadAuthorByPodAndUUID(authorToCreateData.uuid, fromPod.id, t)
      .then(author => {
        if (author) throw new Error('UUID already exists.')

        return undefined
      })
      .then(() => {
        const videoAuthorData = {
          name: authorToCreateData.name,
          uuid: authorToCreateData.uuid,
          userId: null, // Not on our pod
          podId: fromPod.id
        }

        const author = db.Author.build(videoAuthorData)
        return author.save({ transaction: t })
      })
  })
    .then(() => logger.info('Remote video author with uuid %s inserted.', authorToCreateData.uuid))
    .catch(err => {
      logger.debug('Cannot insert the remote video author.', err)
      throw err
    })
}

function removeRemoteVideoAuthorRetryWrapper (authorAttributesToRemove: RemoteVideoAuthorRemoveData, fromPod: PodInstance) {
  const options = {
    arguments: [ authorAttributesToRemove, fromPod ],
    errorMessage: 'Cannot remove the remote video author with many retries.'
  }

  return retryTransactionWrapper(removeRemoteVideoAuthor, options)
}

function removeRemoteVideoAuthor (authorAttributesToRemove: RemoteVideoAuthorRemoveData, fromPod: PodInstance) {
  logger.debug('Removing remote video author "%s".', authorAttributesToRemove.uuid)

  return db.sequelize.transaction(t => {
    return db.Author.loadAuthorByPodAndUUID(authorAttributesToRemove.uuid, fromPod.id, t)
      .then(videoAuthor => videoAuthor.destroy({ transaction: t }))
  })
  .then(() => logger.info('Remote video author with uuid %s removed.', authorAttributesToRemove.uuid))
  .catch(err => {
    logger.debug('Cannot remove the remote video author.', err)
    throw err
  })
}

function addRemoteVideoChannelRetryWrapper (videoChannelToCreateData: RemoteVideoChannelCreateData, fromPod: PodInstance) {
  const options = {
    arguments: [ videoChannelToCreateData, fromPod ],
    errorMessage: 'Cannot insert the remote video channel with many retries.'
  }

  return retryTransactionWrapper(addRemoteVideoChannel, options)
}

function addRemoteVideoChannel (videoChannelToCreateData: RemoteVideoChannelCreateData, fromPod: PodInstance) {
  logger.debug('Adding remote video channel "%s".', videoChannelToCreateData.uuid)

  return db.sequelize.transaction(t => {
    return db.VideoChannel.loadByUUID(videoChannelToCreateData.uuid)
      .then(videoChannel => {
        if (videoChannel) throw new Error('UUID already exists.')

        return undefined
      })
      .then(() => {
        const authorUUID = videoChannelToCreateData.ownerUUID
        const podId = fromPod.id

        return db.Author.loadAuthorByPodAndUUID(authorUUID, podId, t)
      })
      .then(author => {
        if (!author) throw new Error('Unknown author UUID.')

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
        return videoChannel.save({ transaction: t })
      })
  })
  .then(() => logger.info('Remote video channel with uuid %s inserted.', videoChannelToCreateData.uuid))
  .catch(err => {
    logger.debug('Cannot insert the remote video channel.', err)
    throw err
  })
}

function updateRemoteVideoChannelRetryWrapper (videoChannelAttributesToUpdate: RemoteVideoChannelUpdateData, fromPod: PodInstance) {
  const options = {
    arguments: [ videoChannelAttributesToUpdate, fromPod ],
    errorMessage: 'Cannot update the remote video channel with many retries.'
  }

  return retryTransactionWrapper(updateRemoteVideoChannel, options)
}

function updateRemoteVideoChannel (videoChannelAttributesToUpdate: RemoteVideoChannelUpdateData, fromPod: PodInstance) {
  logger.debug('Updating remote video channel "%s".', videoChannelAttributesToUpdate.uuid)

  return db.sequelize.transaction(t => {
    return fetchVideoChannelByHostAndUUID(fromPod.host, videoChannelAttributesToUpdate.uuid, t)
      .then(videoChannelInstance => {
        const options = { transaction: t }

        videoChannelInstance.set('name', videoChannelAttributesToUpdate.name)
        videoChannelInstance.set('description', videoChannelAttributesToUpdate.description)
        videoChannelInstance.set('createdAt', videoChannelAttributesToUpdate.createdAt)
        videoChannelInstance.set('updatedAt', videoChannelAttributesToUpdate.updatedAt)

        return videoChannelInstance.save(options)
      })
  })
  .then(() => logger.info('Remote video channel with uuid %s updated', videoChannelAttributesToUpdate.uuid))
  .catch(err => {
    // This is just a debug because we will retry the insert
    logger.debug('Cannot update the remote video channel.', err)
    throw err
  })
}

function removeRemoteVideoChannelRetryWrapper (videoChannelAttributesToRemove: RemoteVideoChannelRemoveData, fromPod: PodInstance) {
  const options = {
    arguments: [ videoChannelAttributesToRemove, fromPod ],
    errorMessage: 'Cannot remove the remote video channel with many retries.'
  }

  return retryTransactionWrapper(removeRemoteVideoChannel, options)
}

function removeRemoteVideoChannel (videoChannelAttributesToRemove: RemoteVideoChannelRemoveData, fromPod: PodInstance) {
  logger.debug('Removing remote video channel "%s".', videoChannelAttributesToRemove.uuid)

  return db.sequelize.transaction(t => {
    return fetchVideoChannelByHostAndUUID(fromPod.host, videoChannelAttributesToRemove.uuid, t)
      .then(videoChannel => videoChannel.destroy({ transaction: t }))
  })
  .then(() => logger.info('Remote video channel with uuid %s removed.', videoChannelAttributesToRemove.uuid))
  .catch(err => {
    logger.debug('Cannot remove the remote video channel.', err)
    throw err
  })
}

function reportAbuseRemoteVideoRetryWrapper (reportData: RemoteVideoReportAbuseData, fromPod: PodInstance) {
  const options = {
    arguments: [ reportData, fromPod ],
    errorMessage: 'Cannot create remote abuse video with many retries.'
  }

  return retryTransactionWrapper(reportAbuseRemoteVideo, options)
}

function reportAbuseRemoteVideo (reportData: RemoteVideoReportAbuseData, fromPod: PodInstance) {
  logger.debug('Reporting remote abuse for video %s.', reportData.videoUUID)

  return db.sequelize.transaction(t => {
    return fetchVideoByUUID(reportData.videoUUID, t)
      .then(video => {
        const videoAbuseData = {
          reporterUsername: reportData.reporterUsername,
          reason: reportData.reportReason,
          reporterPodId: fromPod.id,
          videoId: video.id
        }

        return db.VideoAbuse.create(videoAbuseData)
      })
  })
  .then(() => logger.info('Remote abuse for video uuid %s created', reportData.videoUUID))
  .catch(err => {
    // This is just a debug because we will retry the insert
    logger.debug('Cannot create remote abuse video', err)
    throw err
  })
}

function fetchVideoByUUID (id: string, t: Sequelize.Transaction) {
  return db.Video.loadByUUID(id, t)
    .then(video => {
      if (!video) throw new Error('Video not found')

      return video
    })
    .catch(err => {
      logger.error('Cannot load owned video from id.', { error: err.stack, id })
      throw err
    })
}

function fetchVideoByHostAndUUID (podHost: string, uuid: string, t: Sequelize.Transaction) {
  return db.Video.loadByHostAndUUID(podHost, uuid, t)
    .then(video => {
      if (!video) throw new Error('Video not found')

      return video
    })
    .catch(err => {
      logger.error('Cannot load video from host and uuid.', { error: err.stack, podHost, uuid })
      throw err
    })
}

function fetchVideoChannelByHostAndUUID (podHost: string, uuid: string, t: Sequelize.Transaction) {
  return db.VideoChannel.loadByHostAndUUID(podHost, uuid, t)
    .then(videoChannel => {
      if (!videoChannel) throw new Error('Video channel not found')

      return videoChannel
    })
    .catch(err => {
      logger.error('Cannot load video channel from host and uuid.', { error: err.stack, podHost, uuid })
      throw err
    })
}
