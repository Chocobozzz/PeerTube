'use strict'

const express = require('express')
const map = require('lodash/map')

const middleware = require('../../../middlewares')
const secureMiddleware = middleware.secure
const cacheMiddleware = middleware.cache
const reqValidator = middleware.reqValidators.remote
const logger = require('../../../helpers/logger')
const Videos = require('../../../models/videos')
const videos = require('../../../lib/videos')

const router = express.Router()

router.post('/add',
  reqValidator.secureRequest,
  secureMiddleware.decryptBody,
  reqValidator.remoteVideosAdd,
  cacheMiddleware.cache(false),
  addRemoteVideos
)

router.post('/remove',
  reqValidator.secureRequest,
  secureMiddleware.decryptBody,
  reqValidator.remoteVideosRemove,
  cacheMiddleware.cache(false),
  removeRemoteVideo
)

// ---------------------------------------------------------------------------

module.exports = router

// ---------------------------------------------------------------------------

function addRemoteVideos (req, res, next) {
  const videosToCreate = req.body.data
  videos.createRemoteVideos(videosToCreate, function (err, remoteVideos) {
    if (err) {
      logger.error('Cannot create remote videos.', { error: err })
      return next(err)
    }

    res.type('json').status(201).end()
  })
}

function removeRemoteVideo (req, res, next) {
  const fromUrl = req.body.signature.url
  const magnetUris = map(req.body.data, 'magnetUri')

  Videos.listFromUrlAndMagnets(fromUrl, magnetUris, function (err, videosList) {
    if (err) {
      logger.error('Cannot list videos from url and magnets.', { error: err })
      return next(err)
    }

    videos.removeRemoteVideos(videosList, function (err) {
      if (err) {
        logger.error('Cannot remove remote videos.', { error: err })
        return next(err)
      }

      res.type('json').status(204).end()
    })
  })
}
