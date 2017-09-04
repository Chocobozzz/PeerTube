import * as express from 'express'
import * as Promise from 'bluebird'

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
import { PodInstance } from '../../../models'
import {
  RemoteVideoRequest,
  RemoteVideoCreateData,
  RemoteVideoUpdateData,
  RemoteVideoRemoveData,
  RemoteVideoReportAbuseData,
  RemoteQaduVideoRequest,
  RemoteQaduVideoData,
  RemoteVideoEventRequest,
  RemoteVideoEventData
} from '../../../../shared'

const ENDPOINT_ACTIONS = REQUEST_ENDPOINT_ACTIONS[REQUEST_ENDPOINTS.VIDEOS]

// Functions to call when processing a remote request
const functionsHash: { [ id: string ]: (...args) => Promise<any> } = {}
functionsHash[ENDPOINT_ACTIONS.ADD] = addRemoteVideoRetryWrapper
functionsHash[ENDPOINT_ACTIONS.UPDATE] = updateRemoteVideoRetryWrapper
functionsHash[ENDPOINT_ACTIONS.REMOVE] = removeRemoteVideo
functionsHash[ENDPOINT_ACTIONS.REPORT_ABUSE] = reportAbuseRemoteVideo

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
      logger.error('Unkown remote request type %s.', request.type)
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
    return fetchVideoByUUID(eventData.uuid)
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
  .then(() => logger.info('Remote video event processed for video %s.', eventData.uuid))
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
  let videoName

  return db.sequelize.transaction(t => {
    return fetchVideoByHostAndUUID(fromPod.host, videoData.uuid)
      .then(videoInstance => {
        const options = { transaction: t }

        videoName = videoInstance.name

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
  .then(() => logger.info('Remote video %s quick and dirty updated', videoName))
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

        return undefined
      })
      .then(() => {
        const name = videoToCreateData.author
        const podId = fromPod.id
        // This author is from another pod so we do not associate a user
        const userId = null

        return db.Author.findOrCreateAuthor(name, podId, userId, t)
      })
      .then(author => {
        const tags = videoToCreateData.tags

        return db.Tag.findOrCreateTags(tags, t).then(tagInstances => ({ author, tagInstances }))
      })
      .then(({ author, tagInstances }) => {
        const videoData = {
          name: videoToCreateData.name,
          uuid: videoToCreateData.uuid,
          category: videoToCreateData.category,
          licence: videoToCreateData.licence,
          language: videoToCreateData.language,
          nsfw: videoToCreateData.nsfw,
          description: videoToCreateData.description,
          authorId: author.id,
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
  .then(() => logger.info('Remote video %s inserted.', videoToCreateData.name))
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
    return fetchVideoByHostAndUUID(fromPod.host, videoAttributesToUpdate.uuid)
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
        videoInstance.set('infoHash', videoAttributesToUpdate.infoHash)
        videoInstance.set('duration', videoAttributesToUpdate.duration)
        videoInstance.set('createdAt', videoAttributesToUpdate.createdAt)
        videoInstance.set('updatedAt', videoAttributesToUpdate.updatedAt)
        videoInstance.set('extname', videoAttributesToUpdate.extname)
        videoInstance.set('views', videoAttributesToUpdate.views)
        videoInstance.set('likes', videoAttributesToUpdate.likes)
        videoInstance.set('dislikes', videoAttributesToUpdate.dislikes)

        return videoInstance.save(options).then(() => ({ videoInstance, tagInstances }))
      })
      .then(({ tagInstances, videoInstance }) => {
        const tasks = []
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
  .then(() => logger.info('Remote video %s updated', videoAttributesToUpdate.name))
  .catch(err => {
    // This is just a debug because we will retry the insert
    logger.debug('Cannot update the remote video.', err)
    throw err
  })
}

function removeRemoteVideo (videoToRemoveData: RemoteVideoRemoveData, fromPod: PodInstance) {
  // We need the instance because we have to remove some other stuffs (thumbnail etc)
  return fetchVideoByHostAndUUID(fromPod.host, videoToRemoveData.uuid)
    .then(video => {
      logger.debug('Removing remote video %s.', video.uuid)
      return video.destroy()
    })
    .catch(err => {
      logger.debug('Could not fetch remote video.', { host: fromPod.host, uuid: videoToRemoveData.uuid, error: err.stack })
    })
}

function reportAbuseRemoteVideo (reportData: RemoteVideoReportAbuseData, fromPod: PodInstance) {
  return fetchVideoByUUID(reportData.videoUUID)
    .then(video => {
      logger.debug('Reporting remote abuse for video %s.', video.id)

      const videoAbuseData = {
        reporterUsername: reportData.reporterUsername,
        reason: reportData.reportReason,
        reporterPodId: fromPod.id,
        videoId: video.id
      }

      return db.VideoAbuse.create(videoAbuseData)
    })
    .catch(err => logger.error('Cannot create remote abuse video.', err))
}

function fetchVideoByUUID (id: string) {
  return db.Video.loadByUUID(id)
    .then(video => {
      if (!video) throw new Error('Video not found')

      return video
    })
    .catch(err => {
      logger.error('Cannot load owned video from id.', { error: err.stack, id })
      throw err
    })
}

function fetchVideoByHostAndUUID (podHost: string, uuid: string) {
  return db.Video.loadByHostAndUUID(podHost, uuid)
    .then(video => {
      if (!video) throw new Error('Video not found')

      return video
    })
    .catch(err => {
      logger.error('Cannot load video from host and uuid.', { error: err.stack, podHost, uuid })
      throw err
    })
}
