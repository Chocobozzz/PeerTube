'use strict'

const each = require('async/each')
const eachSeries = require('async/eachSeries')
const express = require('express')
const mongoose = require('mongoose')

const middlewares = require('../../middlewares')
const secureMiddleware = middlewares.secure
const validators = middlewares.validators.remote
const logger = require('../../helpers/logger')

const router = express.Router()
const Video = mongoose.model('Video')

router.post('/videos',
  validators.signature,
  validators.dataToDecrypt,
  secureMiddleware.checkSignature,
  secureMiddleware.decryptBody,
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
      addRemoteVideo(videoData, callbackEach)
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

function addRemoteVideo (videoToCreateData, callback) {
  logger.debug('Adding remote video %s.', videoToCreateData.magnetUri)

  const video = new Video(videoToCreateData)
  Video.generateThumbnailFromBase64(video, videoToCreateData.thumbnailBase64, function (err) {
    if (err) {
      logger.error('Cannot generate thumbnail from base 64 data.', { error: err })
      return callback(err)
    }

    video.save(callback)
  })
}

function removeRemoteVideo (videoToRemoveData, fromHost, callback) {
  // We need the list because we have to remove some other stuffs (thumbnail etc)
  Video.listByHostAndRemoteId(fromHost, videoToRemoveData.remoteId, function (err, videosList) {
    if (err) {
      logger.error('Cannot list videos from host and magnets.', { error: err })
      return callback(err)
    }

    if (videosList.length === 0) {
      logger.error('No remote video was found for this pod.', { magnetUri: videoToRemoveData.magnetUri, podHost: fromHost })
    }

    each(videosList, function (video, callbackEach) {
      logger.debug('Removing remote video %s.', video.magnetUri)

      video.remove(callbackEach)
    }, callback)
  })
}
