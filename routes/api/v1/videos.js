;(function () {
  'use strict'

  var express = require('express')
  var router = express.Router()
  var middleware = require('../../../middlewares')
  var miscMiddleware = middleware.misc
  var reqValidator = middleware.reqValidators.videos
  var videos = require('../../../src/videos')

  function listVideos (req, res, next) {
    videos.list(function (err, videos_list) {
      if (err) return next(err)

      res.json(videos_list)
    })
  }

  function searchVideos (req, res, next) {
    videos.search(req.params.name, function (err, videos_list) {
      if (err) return next(err)

      res.json(videos_list)
    })
  }

  function addVideos (req, res, next) {
    videos.add({ video: req.files.input_video, data: req.body }, function (err) {
      if (err) return next(err)

      // TODO : include Location of the new video
      res.sendStatus(201)
    })
  }

  function getVideos (req, res, next) {
    videos.get(req.params.id, function (err, video) {
      if (err) return next(err)

      if (video === null) {
        return res.sendStatus(404)
      }

      res.json(video)
    })
  }

  function removeVideo (req, res, next) {
    videos.remove(req.params.id, function (err) {
      if (err) return next(err)

      res.sendStatus(204)
    })
  }

  router.get('/', miscMiddleware.cache(false), listVideos)
  router.post('/', reqValidator.videosAdd, miscMiddleware.cache(false), addVideos)
  router.get('/search/:name', reqValidator.videosSearch, miscMiddleware.cache(false), searchVideos)
  router.get('/:id', reqValidator.videosGet, miscMiddleware.cache(false), getVideos)
  router.delete('/:id', reqValidator.videosRemove, miscMiddleware.cache(false), removeVideo)

  module.exports = router
})()
