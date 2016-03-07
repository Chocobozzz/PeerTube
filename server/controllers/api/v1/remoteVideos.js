'use strict'

var express = require('express')
var pluck = require('lodash-node/compat/collection/pluck')

var middleware = require('../../../middlewares')
var secureMiddleware = middleware.secure
var cacheMiddleware = middleware.cache
var reqValidator = middleware.reqValidators.remote
var videos = require('../../../models/videos')

var router = express.Router()

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
  var url = req.body.signature.url
  var magnetUris = pluck(req.body.data, 'magnetUri')

  videos.removeRemotesOfByMagnetUris(url, magnetUris, function (err) {
    if (err) return next(err)

    res.sendStatus(204)
  })
}
