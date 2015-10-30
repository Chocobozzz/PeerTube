;(function () {
  'use strict'

  var express = require('express')
  var router = express.Router()
  var middleware = require('../../middlewares')
  var videos = require('../../src/videos')

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

  router.get('/', middleware.cache(false), listVideos)
  router.post('/', middleware.cache(false), addVideos)
  router.get('/search/:name', middleware.cache(false), searchVideos)
  router.get('/:id', middleware.cache(false), getVideos)
  router.delete('/:id', middleware.cache(false), removeVideo)

  module.exports = router
})()
