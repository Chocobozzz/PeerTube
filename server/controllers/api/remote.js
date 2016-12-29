'use strict'

const each = require('async/each')
const eachSeries = require('async/eachSeries')
const express = require('express')
const waterfall = require('async/waterfall')

const db = require('../../initializers/database')
const middlewares = require('../../middlewares')
const secureMiddleware = middlewares.secure
const validators = middlewares.validators.remote
const logger = require('../../helpers/logger')

const router = express.Router()

router.post('/videos',
  validators.signature,
  secureMiddleware.checkSignature,
  validators.remoteVideos,
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
    const videoData = request.data

    if (request.type === 'add') {
      addRemoteVideo(videoData, fromPod, callbackEach)
    } else if (request.type === 'remove') {
      removeRemoteVideo(videoData, fromPod, callbackEach)
    } else {
      logger.error('Unkown remote request type %s.', request.type)
    }
  }, function (err) {
    if (err) logger.error('Error managing remote videos.', { error: err })
  })

  // We don't need to keep the other pod waiting
  return res.type('json').status(204).end()
}

function addRemoteVideo (videoToCreateData, fromPod, finalCallback) {
  logger.debug('Adding remote video "%s".', videoToCreateData.name)

  waterfall([

    function startTransaction (callback) {
      db.sequelize.transaction().asCallback(function (err, t) {
        return callback(err, t)
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
        description: videoToCreateData.description,
        authorId: author.id,
        duration: videoToCreateData.duration,
        createdAt: videoToCreateData.createdAt
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
      logger.error('Cannot insert the remote video.')

      // Abort transaction?
      if (t) t.rollback()

      return finalCallback(err)
    }

    // Commit transaction
    t.commit()

    return finalCallback()
  })
}

function removeRemoteVideo (videoToRemoveData, fromPod, callback) {
  // TODO: use bulkDestroy?

  // We need the list because we have to remove some other stuffs (thumbnail etc)
  db.Video.listByHostAndRemoteId(fromPod.host, videoToRemoveData.remoteId, function (err, videosList) {
    if (err) {
      logger.error('Cannot list videos from host and remote id.', { error: err.message })
      return callback(err)
    }

    if (videosList.length === 0) {
      logger.error('No remote video was found for this pod.', { remoteId: videoToRemoveData.remoteId, podHost: fromPod.host })
    }

    each(videosList, function (video, callbackEach) {
      logger.debug('Removing remote video %s.', video.remoteId)

      video.destroy().asCallback(callbackEach)
    }, callback)
  })
}
