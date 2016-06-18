'use strict'

const async = require('async')
const express = require('express')

const middlewares = require('../../../middlewares')
const secureMiddleware = middlewares.secure
const reqValidator = middlewares.reqValidators.remote
const logger = require('../../../helpers/logger')
const Videos = require('../../../models/videos')
const videos = require('../../../lib/videos')

const router = express.Router()

router.post('/videos',
  reqValidator.signature,
  reqValidator.dataToDecrypt,
  secureMiddleware.decryptBody,
  reqValidator.remoteVideos,
  remoteVideos
)

// ---------------------------------------------------------------------------

module.exports = router

// ---------------------------------------------------------------------------

function remoteVideos (req, res, next) {
  const requests = req.body.data
  const fromUrl = req.body.signature.url

  // We need to process in the same order to keep consistency
  // TODO: optimization
  async.eachSeries(requests, function (request, callbackEach) {
    const video = request.data

    if (request.type === 'add') {
      addRemoteVideo(video, callbackEach)
    } else if (request.type === 'remove') {
      removeRemoteVideo(video, fromUrl, callbackEach)
    }
  })

  // We don't need to keep the other pod waiting
  return res.type('json').status(204).end()
}

function addRemoteVideo (videoToCreate, callback) {
  videos.createRemoteVideos([ videoToCreate ], function (err, remoteVideos) {
    if (err) {
      logger.error('Cannot create remote videos.', { error: err })
      // Don't break the process
    }

    return callback()
  })
}

function removeRemoteVideo (videoToRemove, fromUrl, callback) {
  const magnetUris = [ videoToRemove.magnetUri ]

  // We need the list because we have to remove some other stuffs (thumbnail etc)
  Videos.listFromUrlAndMagnets(fromUrl, magnetUris, function (err, videosList) {
    if (err) {
      logger.error('Cannot list videos from url and magnets.', { error: err })
      // Don't break the process
      return callback()
    }

    videos.removeRemoteVideos(videosList, function (err) {
      if (err) {
        logger.error('Cannot remove remote videos.', { error: err })
        // Don't break the process
      }

      return callback()
    })
  })
}
