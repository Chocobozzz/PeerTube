;(function () {
  'use strict'

  var express = require('express')
  var router = express.Router()
  var pluck = require('lodash-node/compat/collection/pluck')

  var middleware = require('../../../middlewares')
  var miscMiddleware = middleware.misc
  var reqValidator = middleware.reqValidators.remote
  var videos = require('../../../models/videos')

  function addRemoteVideos (req, res, next) {
    videos.addRemotes(req.body.data, function (err, videos) {
      if (err) return next(err)

      res.json(videos)
    })
  }

  function removeRemoteVideo (req, res, next) {
    videos.removeRemotes(req.body.signature.url, pluck(req.body.data, 'magnetUri'), function (err) {
      if (err) return next(err)

      res.sendStatus(204)
    })
  }

  router.post('/add', reqValidator.secureRequest, miscMiddleware.decryptBody, reqValidator.remoteVideosAdd, miscMiddleware.cache(false), addRemoteVideos)
  router.post('/remove', reqValidator.secureRequest, miscMiddleware.decryptBody, reqValidator.remoteVideosRemove, miscMiddleware.cache(false), removeRemoteVideo)

  module.exports = router
})()
