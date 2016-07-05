'use strict'

const async = require('async')
const express = require('express')
const mongoose = require('mongoose')

const middlewares = require('../../../middlewares')
const secureMiddleware = middlewares.secure
const validators = middlewares.validators.remote
const logger = require('../../../helpers/logger')

const router = express.Router()
const Video = mongoose.model('Video')

router.post('/videos',
  validators.signature,
  validators.dataToDecrypt,
  secureMiddleware.decryptBody,
  validators.remoteVideos,
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
    const videoData = request.data

    if (request.type === 'add') {
      addRemoteVideo(videoData, callbackEach)
    } else if (request.type === 'remove') {
      removeRemoteVideo(videoData, fromUrl, callbackEach)
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

  // Mongoose pre hook will automatically create the thumbnail on disk
  videoToCreateData.thumbnail = videoToCreateData.thumbnailBase64

  const video = new Video(videoToCreateData)
  video.save(callback)
}

function removeRemoteVideo (videoToRemoveData, fromUrl, callback) {
  // We need the list because we have to remove some other stuffs (thumbnail etc)
  Video.listByUrlAndMagnet(fromUrl, videoToRemoveData.magnetUri, function (err, videosList) {
    if (err) {
      logger.error('Cannot list videos from url and magnets.', { error: err })
      return callback(err)
    }

    if (videosList.length === 0) {
      logger.error('No remote video was found for this pod.', { magnetUri: videoToRemoveData.magnetUri, podUrl: fromUrl })
    }

    async.each(videosList, function (video, callbackEach) {
      logger.debug('Removing remote video %s.', video.magnetUri)

      video.remove(callbackEach)
    }, callback)
  })
}
