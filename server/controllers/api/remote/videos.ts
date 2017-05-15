import express = require('express')
import { eachSeries, waterfall } from 'async'

const db = require('../../../initializers/database')
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
import {
  logger,
  commitTransaction,
  retryTransactionWrapper,
  rollbackTransaction,
  startSerializableTransaction
} from '../../../helpers'
import { quickAndDirtyUpdatesVideoToFriends } from '../../../lib'

const ENDPOINT_ACTIONS = REQUEST_ENDPOINT_ACTIONS[REQUEST_ENDPOINTS.VIDEOS]

// Functions to call when processing a remote request
const functionsHash = {}
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

function remoteVideos (req, res, next) {
  const requests = req.body.data
  const fromPod = res.locals.secure.pod

  // We need to process in the same order to keep consistency
  // TODO: optimization
  eachSeries(requests, function (request: any, callbackEach) {
    const data = request.data

    // Get the function we need to call in order to process the request
    const fun = functionsHash[request.type]
    if (fun === undefined) {
      logger.error('Unkown remote request type %s.', request.type)
      return callbackEach(null)
    }

    fun.call(this, data, fromPod, callbackEach)
  }, function (err) {
    if (err) logger.error('Error managing remote videos.', { error: err })
  })

  // We don't need to keep the other pod waiting
  return res.type('json').status(204).end()
}

function remoteVideosQadu (req, res, next) {
  const requests = req.body.data
  const fromPod = res.locals.secure.pod

  eachSeries(requests, function (request: any, callbackEach) {
    const videoData = request.data

    quickAndDirtyUpdateVideoRetryWrapper(videoData, fromPod, callbackEach)
  }, function (err) {
    if (err) logger.error('Error managing remote videos.', { error: err })
  })

  return res.type('json').status(204).end()
}

function remoteVideosEvents (req, res, next) {
  const requests = req.body.data
  const fromPod = res.locals.secure.pod

  eachSeries(requests, function (request: any, callbackEach) {
    const eventData = request.data

    processVideosEventsRetryWrapper(eventData, fromPod, callbackEach)
  }, function (err) {
    if (err) logger.error('Error managing remote videos.', { error: err })
  })

  return res.type('json').status(204).end()
}

function processVideosEventsRetryWrapper (eventData, fromPod, finalCallback) {
  const options = {
    arguments: [ eventData, fromPod ],
    errorMessage: 'Cannot process videos events with many retries.'
  }

  retryTransactionWrapper(processVideosEvents, options, finalCallback)
}

function processVideosEvents (eventData, fromPod, finalCallback) {
  waterfall([
    startSerializableTransaction,

    function findVideo (t, callback) {
      fetchOwnedVideo(eventData.remoteId, function (err, videoInstance) {
        return callback(err, t, videoInstance)
      })
    },

    function updateVideoIntoDB (t, videoInstance, callback) {
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
          return callback(new Error('Unknown video event type.'))
      }

      const query = {}
      query[columnToUpdate] = eventData.count

      videoInstance.increment(query, options).asCallback(function (err) {
        return callback(err, t, videoInstance, qaduType)
      })
    },

    function sendQaduToFriends (t, videoInstance, qaduType, callback) {
      const qadusParams = [
        {
          videoId: videoInstance.id,
          type: qaduType
        }
      ]

      quickAndDirtyUpdatesVideoToFriends(qadusParams, t, function (err) {
        return callback(err, t)
      })
    },

    commitTransaction

  ], function (err, t) {
    if (err) {
      logger.debug('Cannot process a video event.', { error: err })
      return rollbackTransaction(err, t, finalCallback)
    }

    logger.info('Remote video event processed for video %s.', eventData.remoteId)
    return finalCallback(null)
  })
}

function quickAndDirtyUpdateVideoRetryWrapper (videoData, fromPod, finalCallback) {
  const options = {
    arguments: [ videoData, fromPod ],
    errorMessage: 'Cannot update quick and dirty the remote video with many retries.'
  }

  retryTransactionWrapper(quickAndDirtyUpdateVideo, options, finalCallback)
}

function quickAndDirtyUpdateVideo (videoData, fromPod, finalCallback) {
  let videoName

  waterfall([
    startSerializableTransaction,

    function findVideo (t, callback) {
      fetchRemoteVideo(fromPod.host, videoData.remoteId, function (err, videoInstance) {
        return callback(err, t, videoInstance)
      })
    },

    function updateVideoIntoDB (t, videoInstance, callback) {
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

      videoInstance.save(options).asCallback(function (err) {
        return callback(err, t)
      })
    },

    commitTransaction

  ], function (err, t) {
    if (err) {
      logger.debug('Cannot quick and dirty update the remote video.', { error: err })
      return rollbackTransaction(err, t, finalCallback)
    }

    logger.info('Remote video %s quick and dirty updated', videoName)
    return finalCallback(null)
  })
}

// Handle retries on fail
function addRemoteVideoRetryWrapper (videoToCreateData, fromPod, finalCallback) {
  const options = {
    arguments: [ videoToCreateData, fromPod ],
    errorMessage: 'Cannot insert the remote video with many retries.'
  }

  retryTransactionWrapper(addRemoteVideo, options, finalCallback)
}

function addRemoteVideo (videoToCreateData, fromPod, finalCallback) {
  logger.debug('Adding remote video "%s".', videoToCreateData.remoteId)

  waterfall([

    startSerializableTransaction,

    function assertRemoteIdAndHostUnique (t, callback) {
      db.Video.loadByHostAndRemoteId(fromPod.host, videoToCreateData.remoteId, function (err, video) {
        if (err) return callback(err)

        if (video) return callback(new Error('RemoteId and host pair is not unique.'))

        return callback(null, t)
      })
    },

    function findOrCreateAuthor (t, callback) {
      const name = videoToCreateData.author
      const podId = fromPod.id
      // This author is from another pod so we do not associate a user
      const userId = null

      db.Author.findOrCreateAuthor(name, podId, userId, t, function (err, authorInstance) {
        return callback(err, t, authorInstance)
      })
    },

    function findOrCreateTags (t, author, callback) {
      const tags = videoToCreateData.tags

      db.Tag.findOrCreateTags(tags, t, function (err, tagInstances) {
        return callback(err, t, author, tagInstances)
      })
    },

    function createVideoObject (t, author, tagInstances, callback) {
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

      return callback(null, t, tagInstances, video)
    },

    function generateThumbnail (t, tagInstances, video, callback) {
      db.Video.generateThumbnailFromData(video, videoToCreateData.thumbnailData, function (err) {
        if (err) {
          logger.error('Cannot generate thumbnail from data.', { error: err })
          return callback(err)
        }

        return callback(err, t, tagInstances, video)
      })
    },

    function insertVideoIntoDB (t, tagInstances, video, callback) {
      const options = {
        transaction: t
      }

      video.save(options).asCallback(function (err, videoCreated) {
        return callback(err, t, tagInstances, videoCreated)
      })
    },

    function associateTagsToVideo (t, tagInstances, video, callback) {
      const options = {
        transaction: t
      }

      video.setTags(tagInstances, options).asCallback(function (err) {
        return callback(err, t)
      })
    },

    commitTransaction

  ], function (err, t) {
    if (err) {
      // This is just a debug because we will retry the insert
      logger.debug('Cannot insert the remote video.', { error: err })
      return rollbackTransaction(err, t, finalCallback)
    }

    logger.info('Remote video %s inserted.', videoToCreateData.name)
    return finalCallback(null)
  })
}

// Handle retries on fail
function updateRemoteVideoRetryWrapper (videoAttributesToUpdate, fromPod, finalCallback) {
  const options = {
    arguments: [ videoAttributesToUpdate, fromPod ],
    errorMessage: 'Cannot update the remote video with many retries'
  }

  retryTransactionWrapper(updateRemoteVideo, options, finalCallback)
}

function updateRemoteVideo (videoAttributesToUpdate, fromPod, finalCallback) {
  logger.debug('Updating remote video "%s".', videoAttributesToUpdate.remoteId)

  waterfall([

    startSerializableTransaction,

    function findVideo (t, callback) {
      fetchRemoteVideo(fromPod.host, videoAttributesToUpdate.remoteId, function (err, videoInstance) {
        return callback(err, t, videoInstance)
      })
    },

    function findOrCreateTags (t, videoInstance, callback) {
      const tags = videoAttributesToUpdate.tags

      db.Tag.findOrCreateTags(tags, t, function (err, tagInstances) {
        return callback(err, t, videoInstance, tagInstances)
      })
    },

    function updateVideoIntoDB (t, videoInstance, tagInstances, callback) {
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

      videoInstance.save(options).asCallback(function (err) {
        return callback(err, t, videoInstance, tagInstances)
      })
    },

    function associateTagsToVideo (t, videoInstance, tagInstances, callback) {
      const options = { transaction: t }

      videoInstance.setTags(tagInstances, options).asCallback(function (err) {
        return callback(err, t)
      })
    },

    commitTransaction

  ], function (err, t) {
    if (err) {
      // This is just a debug because we will retry the insert
      logger.debug('Cannot update the remote video.', { error: err })
      return rollbackTransaction(err, t, finalCallback)
    }

    logger.info('Remote video %s updated', videoAttributesToUpdate.name)
    return finalCallback(null)
  })
}

function removeRemoteVideo (videoToRemoveData, fromPod, callback) {
  // We need the instance because we have to remove some other stuffs (thumbnail etc)
  fetchRemoteVideo(fromPod.host, videoToRemoveData.remoteId, function (err, video) {
    // Do not return the error, continue the process
    if (err) return callback(null)

    logger.debug('Removing remote video %s.', video.remoteId)
    video.destroy().asCallback(function (err) {
      // Do not return the error, continue the process
      if (err) {
        logger.error('Cannot remove remote video with id %s.', videoToRemoveData.remoteId, { error: err })
      }

      return callback(null)
    })
  })
}

function reportAbuseRemoteVideo (reportData, fromPod, callback) {
  fetchOwnedVideo(reportData.videoRemoteId, function (err, video) {
    if (err || !video) {
      if (!err) err = new Error('video not found')

      logger.error('Cannot load video from id.', { error: err, id: reportData.videoRemoteId })
      // Do not return the error, continue the process
      return callback(null)
    }

    logger.debug('Reporting remote abuse for video %s.', video.id)

    const videoAbuseData = {
      reporterUsername: reportData.reporterUsername,
      reason: reportData.reportReason,
      reporterPodId: fromPod.id,
      videoId: video.id
    }

    db.VideoAbuse.create(videoAbuseData).asCallback(function (err) {
      if (err) {
        logger.error('Cannot create remote abuse video.', { error: err })
      }

      return callback(null)
    })
  })
}

function fetchOwnedVideo (id, callback) {
  db.Video.load(id, function (err, video) {
    if (err || !video) {
      if (!err) err = new Error('video not found')

      logger.error('Cannot load owned video from id.', { error: err, id })
      return callback(err)
    }

    return callback(null, video)
  })
}

function fetchRemoteVideo (podHost, remoteId, callback) {
  db.Video.loadByHostAndRemoteId(podHost, remoteId, function (err, video) {
    if (err || !video) {
      if (!err) err = new Error('video not found')

      logger.error('Cannot load video from host and remote id.', { error: err, podHost, remoteId })
      return callback(err)
    }

    return callback(null, video)
  })
}
