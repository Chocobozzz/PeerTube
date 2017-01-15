'use strict'

const eachSeries = require('async/eachSeries')
const express = require('express')
const waterfall = require('async/waterfall')

const db = require('../../../initializers/database')
const middlewares = require('../../../middlewares')
const secureMiddleware = middlewares.secure
const videosValidators = middlewares.validators.remote.videos
const signatureValidators = middlewares.validators.remote.signature
const logger = require('../../../helpers/logger')
const databaseUtils = require('../../../helpers/database-utils')

const router = express.Router()

router.post('/',
  signatureValidators.signature,
  secureMiddleware.checkSignature,
  videosValidators.remoteVideos,
  remoteVideos
)

// ---------------------------------------------------------------------------

module.exports = router

// ---------------------------------------------------------------------------

function remoteVideos (req, res, next) {
  const requests = req.body.data
  const fromPod = res.locals.secure.pod

  // We need to process in the same order to keep consistency
  // TODO: optimization
  eachSeries(requests, function (request, callbackEach) {
    const data = request.data

    switch (request.type) {
      case 'add':
        addRemoteVideoRetryWrapper(data, fromPod, callbackEach)
        break

      case 'update':
        updateRemoteVideoRetryWrapper(data, fromPod, callbackEach)
        break

      case 'remove':
        removeRemoteVideo(data, fromPod, callbackEach)
        break

      case 'report-abuse':
        reportAbuseRemoteVideo(data, fromPod, callbackEach)
        break

      default:
        logger.error('Unkown remote request type %s.', request.type)
    }
  }, function (err) {
    if (err) logger.error('Error managing remote videos.', { error: err })
  })

  // We don't need to keep the other pod waiting
  return res.type('json').status(204).end()
}

// Handle retries on fail
function addRemoteVideoRetryWrapper (videoToCreateData, fromPod, finalCallback) {
  const options = {
    arguments: [ videoToCreateData, fromPod ],
    errorMessage: 'Cannot insert the remote video with many retries.'
  }

  databaseUtils.retryTransactionWrapper(addRemoteVideo, options, finalCallback)
}

function addRemoteVideo (videoToCreateData, fromPod, finalCallback) {
  logger.debug('Adding remote video "%s".', videoToCreateData.remoteId)

  waterfall([

    databaseUtils.startSerializableTransaction,

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
        description: videoToCreateData.description,
        authorId: author.id,
        duration: videoToCreateData.duration,
        createdAt: videoToCreateData.createdAt,
        // FIXME: updatedAt does not seems to be considered by Sequelize
        updatedAt: videoToCreateData.updatedAt
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
      const options = { transaction: t }

      video.setTags(tagInstances, options).asCallback(function (err) {
        return callback(err, t)
      })
    }

  ], function (err, t) {
    if (err) {
      // This is just a debug because we will retry the insert
      logger.debug('Cannot insert the remote video.', { error: err })

      // Abort transaction?
      if (t) t.rollback()

      return finalCallback(err)
    }

    // Commit transaction
    t.commit().asCallback(function (err) {
      if (err) return finalCallback(err)

      logger.info('Remote video %s inserted.', videoToCreateData.name)
      return finalCallback(null)
    })
  })
}

// Handle retries on fail
function updateRemoteVideoRetryWrapper (videoAttributesToUpdate, fromPod, finalCallback) {
  const options = {
    arguments: [ fromPod, videoAttributesToUpdate ],
    errorMessage: 'Cannot update the remote video with many retries'
  }

  databaseUtils.retryWrapper(updateRemoteVideo, options, finalCallback)
}

function updateRemoteVideo (videoAttributesToUpdate, fromPod, finalCallback) {
  logger.debug('Updating remote video "%s".', videoAttributesToUpdate.remoteId)

  waterfall([

    databaseUtils.startSerializableTransaction,

    function findVideo (t, callback) {
      fetchVideo(fromPod.host, videoAttributesToUpdate.remoteId, function (err, videoInstance) {
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
      videoInstance.set('description', videoAttributesToUpdate.description)
      videoInstance.set('infoHash', videoAttributesToUpdate.infoHash)
      videoInstance.set('duration', videoAttributesToUpdate.duration)
      videoInstance.set('createdAt', videoAttributesToUpdate.createdAt)
      videoInstance.set('updatedAt', videoAttributesToUpdate.updatedAt)
      videoInstance.set('extname', videoAttributesToUpdate.extname)

      videoInstance.save(options).asCallback(function (err) {
        return callback(err, t, videoInstance, tagInstances)
      })
    },

    function associateTagsToVideo (t, videoInstance, tagInstances, callback) {
      const options = { transaction: t }

      videoInstance.setTags(tagInstances, options).asCallback(function (err) {
        return callback(err, t)
      })
    }

  ], function (err, t) {
    if (err) {
      // This is just a debug because we will retry the insert
      logger.debug('Cannot update the remote video.', { error: err })

      // Abort transaction?
      if (t) t.rollback()

      return finalCallback(err)
    }

   // Commit transaction
    t.commit().asCallback(function (err) {
      if (err) return finalCallback(err)

      logger.info('Remote video %s updated', videoAttributesToUpdate.name)
      return finalCallback(null)
    })
  })
}

function removeRemoteVideo (videoToRemoveData, fromPod, callback) {
  // We need the instance because we have to remove some other stuffs (thumbnail etc)
  fetchVideo(fromPod.host, videoToRemoveData.remoteId, function (err, video) {
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
  db.Video.load(reportData.videoRemoteId, function (err, video) {
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

function fetchVideo (podHost, remoteId, callback) {
  db.Video.loadByHostAndRemoteId(podHost, remoteId, function (err, video) {
    if (err || !video) {
      if (!err) err = new Error('video not found')

      logger.error('Cannot load video from host and remote id.', { error: err, podHost, remoteId })
      return callback(err)
    }

    return callback(null, video)
  })
}
