'use strict'

const express = require('express')
const map = require('lodash/map')

const middleware = require('../../../middlewares')
const secureMiddleware = middleware.secure
const cacheMiddleware = middleware.cache
const reqValidator = middleware.reqValidators.remote
const videos = require('../../../models/videos')

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
  videos.addRemotes(req.body.data, function (err, videos) {
    if (err) return next(err)

    res.json(videos)
  })
}

function removeRemoteVideo (req, res, next) {
  const url = req.body.signature.url
  const magnetUris = map(req.body.data, 'magnetUri')

  videos.removeRemotesOfByMagnetUris(url, magnetUris, function (err) {
    if (err) return next(err)

    res.type('json').status(204).end()
  })
}
