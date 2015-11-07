;(function () {
  'use strict'

  var express = require('express')
  var router = express.Router()
  var middleware = require('../../../middlewares')
  var miscMiddleware = middleware.misc
  var reqValidator = middleware.reqValidators.remote
  var videos = require('../../../src/videos')

  function addRemoteVideos (req, res, next) {
    videos.addRemote(req.body.data, function (err, video) {
      if (err) return next(err)

      res.json(video)
    })
  }

  function removeRemoteVideo (req, res, next) {
    videos.removeRemote(req.body.signature.url, req.body.data.magnetUri, function (err) {
      if (err) return next(err)

      res.status(204)
    })
  }

  router.post('/add', reqValidator.secureRequest, miscMiddleware.decryptBody, reqValidator.remoteVideosAdd, miscMiddleware.cache(false), addRemoteVideos)
  router.post('/remove', reqValidator.secureRequest, miscMiddleware.decryptBody, reqValidator.remoteVideosRemove, miscMiddleware.cache(false), removeRemoteVideo)

  module.exports = router
})()
