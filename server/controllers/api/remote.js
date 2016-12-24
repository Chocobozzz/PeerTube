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
  const fromHost = req.body.signature.host

  // We need to process in the same order to keep consistency
  // TODO: optimization
  eachSeries(requests, function (request, callbackEach) {
    const videoData = request.data

    if (request.type === 'add') {
      addRemoteVideo(videoData, fromHost, callbackEach)
    } else if (request.type === 'remove') {
      removeRemoteVideo(videoData, fromHost, callbackEach)
    } else {
      logger.error('Unkown remote request type %s.', request.type)
    }
  }, function (err) {
    if (err) logger.error('Error managing remote videos.', { error: err })
  })

  // We don't need to keep the other pod waiting
  return res.type('json').status(204).end()
}

function addRemoteVideo (videoToCreateData, fromHost, finalCallback) {
  logger.debug('Adding remote video "%s".', videoToCreateData.name)

  waterfall([

    function startTransaction (callback) {
      db.sequelize.transaction().asCallback(function (err, t) {
        return callback(err, t)
      })
    },

    function findOrCreatePod (t, callback) {
      const query = {
        where: {
          host: fromHost
        },
        defaults: {
          host: fromHost
        },
        transaction: t
      }

      db.Pod.findOrCreate(query).asCallback(function (err, result) {
        // [ instance, wasCreated ]
        return callback(err, t, result[0])
      })
    },

    function findOrCreateAuthor (t, pod, callback) {
      const username = videoToCreateData.author

      const query = {
        where: {
          name: username,
          podId: pod.id
        },
        defaults: {
          name: username,
          podId: pod.id
        },
        transaction: t
      }

      db.Author.findOrCreate(query).asCallback(function (err, result) {
        // [ instance, wasCreated ]
        return callback(err, t, result[0])
      })
    },

    function findOrCreateTags (t, author, callback) {
      const tags = videoToCreateData.tags
      const tagInstances = []

      each(tags, function (tag, callbackEach) {
        const query = {
          where: {
            name: tag
          },
          defaults: {
            name: tag
          },
          transaction: t
        }

        db.Tag.findOrCreate(query).asCallback(function (err, res) {
          if (err) return callbackEach(err)

          // res = [ tag, isCreated ]
          const tag = res[0]
          tagInstances.push(tag)
          return callbackEach()
        })
      }, function (err) {
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
        duration: videoToCreateData.duration
      }

      const video = db.Video.build(videoData)

      return callback(null, t, tagInstances, video)
    },

    function generateThumbnail (t, tagInstances, video, callback) {
      db.Video.generateThumbnailFromBase64(video, videoToCreateData.thumbnailBase64, function (err) {
        if (err) {
          logger.error('Cannot generate thumbnail from base 64 data.', { error: err })
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

function removeRemoteVideo (videoToRemoveData, fromHost, callback) {
  // TODO: use bulkDestroy?

  // We need the list because we have to remove some other stuffs (thumbnail etc)
  db.Video.listByHostAndRemoteId(fromHost, videoToRemoveData.remoteId, function (err, videosList) {
    if (err) {
      logger.error('Cannot list videos from host and remote id.', { error: err.message })
      return callback(err)
    }

    if (videosList.length === 0) {
      logger.error('No remote video was found for this pod.', { remoteId: videoToRemoveData.remoteId, podHost: fromHost })
    }

    each(videosList, function (video, callbackEach) {
      logger.debug('Removing remote video %s.', video.remoteId)

      video.destroy().asCallback(callbackEach)
    }, callback)
  })
}
