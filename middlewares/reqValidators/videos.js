;(function () {
  'use strict'

  var checkErrors = require('./utils').checkErrors
  var VideosDB = require('../../src/database').VideosDB
  var logger = require('../../src/logger')

  var videos = {}

  function findVideoById (id, callback) {
    VideosDB.findById(id, { _id: 1, namePath: 1 }).limit(1).exec(function (err, video) {
      if (err) throw err

      callback(video)
    })
  }

  videos.videosSearch = function (req, res, next) {
    req.checkParams('name', 'Should have a name').notEmpty()

    logger.debug('Checking videosSearch parameters', { parameters: req.params })

    checkErrors(req, res, next)
  }

  videos.videosAdd = function (req, res, next) {
    req.checkFiles('input_video[0].originalname', 'Should have an input video').notEmpty()
    req.checkFiles('input_video[0].mimetype', 'Should have a correct mime type').matches(/video\/(webm)|(mp4)|(ogg)/i)
    req.checkBody('name', 'Should have a name').isLength(1, 50)
    req.checkBody('description', 'Should have a description').isLength(1, 250)

    logger.debug('Checking videosAdd parameters', { parameters: req.body, files: req.files })

    checkErrors(req, res, next)
  }

  videos.videosGet = function (req, res, next) {
    req.checkParams('id', 'Should have a valid id').notEmpty().isMongoId()

    logger.debug('Checking videosGet parameters', { parameters: req.params })

    checkErrors(req, res, function () {
      findVideoById(req.params.id, function (video) {
        if (!video) return res.status(404).send('Video not found')

        next()
      })
    })
  }

  videos.videosRemove = function (req, res, next) {
    req.checkParams('id', 'Should have a valid id').notEmpty().isMongoId()

    logger.debug('Checking videosRemove parameters', { parameters: req.params })

    checkErrors(req, res, function () {
      findVideoById(req.params.id, function (video) {
        if (!video) return res.status(404).send('Video not found')
        else if (video.namePath === null) return res.status(403).send('Cannot remove video of another pod')

        next()
      })
    })
  }

  module.exports = videos
})()
