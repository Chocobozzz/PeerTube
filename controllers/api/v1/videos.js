;(function () {
  'use strict'

  var config = require('config')
  var crypto = require('crypto')
  var express = require('express')
  var multer = require('multer')

  var logger = require('../../../helpers/logger')
  var friends = require('../../../lib/friends')
  var middleware = require('../../../middlewares')
  var cacheMiddleware = middleware.cache
  var reqValidator = middleware.reqValidators.videos
  var Videos = require('../../../models/videos') // model
  var videos = require('../../../lib/videos')
  var webtorrent = require('../../../lib/webtorrent')

  var router = express.Router()
  var uploads = config.get('storage.uploads')

  // multer configuration
  var storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, uploads)
    },

    filename: function (req, file, cb) {
      var extension = ''
      if (file.mimetype === 'video/webm') extension = 'webm'
      else if (file.mimetype === 'video/mp4') extension = 'mp4'
      else if (file.mimetype === 'video/ogg') extension = 'ogv'
      crypto.pseudoRandomBytes(16, function (err, raw) {
        var fieldname = err ? undefined : raw.toString('hex')
        cb(null, fieldname + '.' + extension)
      })
    }
  })

  var reqFiles = multer({ storage: storage }).fields([{ name: 'input_video', maxCount: 1 }])

  router.get('/', cacheMiddleware.cache(false), listVideos)
  router.post('/', reqFiles, reqValidator.videosAdd, cacheMiddleware.cache(false), addVideo)
  router.get('/:id', reqValidator.videosGet, cacheMiddleware.cache(false), getVideos)
  router.delete('/:id', reqValidator.videosRemove, cacheMiddleware.cache(false), removeVideo)
  router.get('/search/:name', reqValidator.videosSearch, cacheMiddleware.cache(false), searchVideos)

  // ---------------------------------------------------------------------------

  module.exports = router

  // ---------------------------------------------------------------------------

  function addVideo (req, res, next) {
    var video_file = req.files.input_video[0]
    var video_infos = req.body

    videos.seed(video_file.path, function (err, torrent) {
      if (err) {
        logger.error('Cannot seed this video.')
        return next(err)
      }

      var video_data = {
        name: video_infos.name,
        namePath: video_file.filename,
        description: video_infos.description,
        magnetUri: torrent.magnetURI
      }

      Videos.add(video_data, function (err) {
        if (err) {
          // TODO unseed the video
          logger.error('Cannot insert this video in the database.')
          return next(err)
        }

        // Now we'll add the video's meta data to our friends
        friends.addVideoToFriends(video_data)

        // TODO : include Location of the new video
        res.sendStatus(201)
      })
    })
  }

  function getVideos (req, res, next) {
    Videos.get(req.params.id, function (err, video) {
      if (err) return next(err)

      if (video === null) {
        return res.sendStatus(404)
      }

      res.json(video)
    })
  }

  function listVideos (req, res, next) {
    Videos.list(function (err, videos_list) {
      if (err) return next(err)

      res.json(videos_list)
    })
  }

  function removeVideo (req, res, next) {
    var video_id = req.params.id
    Videos.get(video_id, function (err, video) {
      if (err) return next(err)

      removeTorrent(video.magnetUri, function () {
        Videos.removeOwned(req.params.id, function (err) {
          if (err) return next(err)

          var params = {
            name: video.name,
            magnetUri: video.magnetUri
          }

          friends.removeVideoToFriends(params)
          res.sendStatus(204)
        })
      })
    })
  }

  function searchVideos (req, res, next) {
    Videos.search(req.params.name, function (err, videos_list) {
      if (err) return next(err)

      res.json(videos_list)
    })
  }

  // ---------------------------------------------------------------------------

  // Maybe the torrent is not seeded, but we catch the error to don't stop the removing process
  function removeTorrent (magnetUri, callback) {
    try {
      webtorrent.remove(magnetUri, callback)
    } catch (err) {
      logger.warn('Cannot remove the torrent from WebTorrent', { err: err })
      return callback(null)
    }
  }
})()
