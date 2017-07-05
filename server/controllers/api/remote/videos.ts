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
import { PodInstance, VideoInstance } from '../../../models'

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
  const requests = req.body.data
  const fromPod = res.locals.secure.pod

  // We need to process in the same order to keep consistency
  // TODO: optimization
  Promise.mapSeries(requests, (request: any) => {
    const data = request.data

    // Get the function we need to call in order to process the request
    const fun = functionsHash[request.type]
    if (fun === undefined) {
      logger.error('Unkown remote request type %s.', request.type)
      return
    }

    return fun.call(this, data, fromPod)
  })
  .catch(err => logger.error('Error managing remote videos.', { error: err }))

  // We don't need to keep the other pod waiting
  return res.type('json').status(204).end()
}

function remoteVideosQadu (req: express.Request, res: express.Response, next: express.NextFunction) {
  const requests = req.body.data
  const fromPod = res.locals.secure.pod

  Promise.mapSeries(requests, (request: any) => {
    const videoData = request.data

    return quickAndDirtyUpdateVideoRetryWrapper(videoData, fromPod)
  })
  .catch(err => logger.error('Error managing remote videos.', { error: err }))

  return res.type('json').status(204).end()
}

function remoteVideosEvents (req: express.Request, res: express.Response, next: express.NextFunction) {
  const requests = req.body.data
  const fromPod = res.locals.secure.pod

  Promise.mapSeries(requests, (request: any) => {
    const eventData = request.data

    return processVideosEventsRetryWrapper(eventData, fromPod)
  })
  .catch(err => logger.error('Error managing remote videos.', { error: err }))

  return res.type('json').status(204).end()
}

function processVideosEventsRetryWrapper (eventData: any, fromPod: PodInstance) {
  const options = {
    arguments: [ eventData, fromPod ],
    errorMessage: 'Cannot process videos events with many retries.'
  }

  return retryTransactionWrapper(processVideosEvents, options)
}

function processVideosEvents (eventData: any, fromPod: PodInstance) {

  return db.sequelize.transaction(t => {
    return fetchOwnedVideo(eventData.remoteId)
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
  .then(() => logger.info('Remote video event processed for video %s.', eventData.remoteId))
  .catch(err => {
    logger.debug('Cannot process a video event.', { error: err })
    throw err
  })
}

function quickAndDirtyUpdateVideoRetryWrapper (videoData: any, fromPod: PodInstance) {
  const options = {
    arguments: [ videoData, fromPod ],
    errorMessage: 'Cannot update quick and dirty the remote video with many retries.'
  }

  return retryTransactionWrapper(quickAndDirtyUpdateVideo, options)
}

function quickAndDirtyUpdateVideo (videoData: any, fromPod: PodInstance) {
  let videoName

  return db.sequelize.transaction(t => {
    return fetchRemoteVideo(fromPod.host, videoData.remoteId)
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
  .catch(err => logger.debug('Cannot quick and dirty update the remote video.', { error: err }))
}

// Handle retries on fail
function addRemoteVideoRetryWrapper (videoToCreateData: any, fromPod: PodInstance) {
  const options = {
    arguments: [ videoToCreateData, fromPod ],
    errorMessage: 'Cannot insert the remote video with many retries.'
  }

  return retryTransactionWrapper(addRemoteVideo, options)
}

function addRemoteVideo (videoToCreateData: any, fromPod: PodInstance) {
  logger.debug('Adding remote video "%s".', videoToCreateData.remoteId)

  return db.sequelize.transaction(t => {
    return db.Video.loadByHostAndRemoteId(fromPod.host, videoToCreateData.remoteId)
      .then(video => {
        if (video) throw new Error('RemoteId and host pair is not unique.')

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
          remoteId: videoToCreateData.remoteId,
          extname: videoToCreateData.extname,
          infoHash: videoToCreateData.infoHash,
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
          dislikes: videoToCreateData.dislikes
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
        const options = {
          transaction: t
        }

        return videoCreated.setTags(tagInstances, options)
      })
  })
  .then(() => logger.info('Remote video %s inserted.', videoToCreateData.name))
  .catch(err => {
    logger.debug('Cannot insert the remote video.', { error: err })
    throw err
  })
}

// Handle retries on fail
function updateRemoteVideoRetryWrapper (videoAttributesToUpdate: any, fromPod: PodInstance) {
  const options = {
    arguments: [ videoAttributesToUpdate, fromPod ],
    errorMessage: 'Cannot update the remote video with many retries'
  }

  return retryTransactionWrapper(updateRemoteVideo, options)
}

function updateRemoteVideo (videoAttributesToUpdate: any, fromPod: PodInstance) {
  logger.debug('Updating remote video "%s".', videoAttributesToUpdate.remoteId)

  return db.sequelize.transaction(t => {
    return fetchRemoteVideo(fromPod.host, videoAttributesToUpdate.remoteId)
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
      .then(({ videoInstance, tagInstances }) => {
        const options = { transaction: t }

        return videoInstance.setTags(tagInstances, options)
      })
  })
  .then(() => logger.info('Remote video %s updated', videoAttributesToUpdate.name))
  .catch(err => {
    // This is just a debug because we will retry the insert
    logger.debug('Cannot update the remote video.', { error: err })
    throw err
  })
}

function removeRemoteVideo (videoToRemoveData: any, fromPod: PodInstance) {
  // We need the instance because we have to remove some other stuffs (thumbnail etc)
  return fetchRemoteVideo(fromPod.host, videoToRemoveData.remoteId)
    .then(video => {
      logger.debug('Removing remote video %s.', video.remoteId)
      return video.destroy()
    })
    .catch(err => {
      logger.debug('Could not fetch remote video.', { host: fromPod.host, remoteId: videoToRemoveData.remoteId, error: err })
    })
}

function reportAbuseRemoteVideo (reportData: any, fromPod: PodInstance) {
  return fetchOwnedVideo(reportData.videoRemoteId)
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
    .catch(err => logger.error('Cannot create remote abuse video.', { error: err }))
}

function fetchOwnedVideo (id: string) {
  return db.Video.load(id)
    .then(video => {
      if (!video) throw new Error('Video not found')

      return video
    })
    .catch(err => {
      logger.error('Cannot load owned video from id.', { error: err, id })
      throw err
    })
}

function fetchRemoteVideo (podHost: string, remoteId: string) {
  return db.Video.loadByHostAndRemoteId(podHost, remoteId)
    .then(video => {
      if (!video) throw new Error('Video not found')

      return video
    })
    .catch(err => {
      logger.error('Cannot load video from host and remote id.', { error: err, podHost, remoteId })
      throw err
    })
}
