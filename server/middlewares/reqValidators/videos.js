'use strict'

const checkErrors = require('./utils').checkErrors
const logger = require('../../helpers/logger')
const videos = require('../../lib/videos')
const Videos = require('../../models/videos')

const reqValidatorsVideos = {
  videosAdd: videosAdd,
  videosGet: videosGet,
  videosRemove: videosRemove,
  videosSearch: videosSearch
}

function videosAdd (req, res, next) {
  req.checkFiles('input_video[0].originalname', 'Should have an input video').notEmpty()
  req.checkFiles('input_video[0].mimetype', 'Should have a correct mime type').matches(/video\/(webm)|(mp4)|(ogg)/i)
  req.checkBody('name', 'Should have a name').isLength(1, 50)
  req.checkBody('description', 'Should have a description').isLength(1, 250)

  logger.debug('Checking videosAdd parameters', { parameters: req.body, files: req.files })

  checkErrors(req, res, next)
}

function videosGet (req, res, next) {
  req.checkParams('id', 'Should have a valid id').notEmpty().isMongoId()

  logger.debug('Checking videosGet parameters', { parameters: req.params })

  checkErrors(req, res, function () {
    Videos.get(req.params.id, function (err, video) {
      if (err) {
        logger.error('Error in videosGet request validator.', { error: err })
        res.sendStatus(500)
      }

      videos.getVideoState(video, function (state) {
        if (state.exist === false) return res.status(404).send('Video not found')

        next()
      })
    })
  })
}

function videosRemove (req, res, next) {
  req.checkParams('id', 'Should have a valid id').notEmpty().isMongoId()

  logger.debug('Checking videosRemove parameters', { parameters: req.params })

  checkErrors(req, res, function () {
    Videos.get(req.params.id, function (err, video) {
      if (err) {
        logger.error('Error in videosRemove request validator.', { error: err })
        res.sendStatus(500)
      }

      videos.getVideoState(video, function (state) {
        if (state.exist === false) return res.status(404).send('Video not found')
        else if (state.owned === false) return res.status(403).send('Cannot remove video of another pod')

        next()
      })
    })
  })
}

function videosSearch (req, res, next) {
  req.checkParams('name', 'Should have a name').notEmpty()

  logger.debug('Checking videosSearch parameters', { parameters: req.params })

  checkErrors(req, res, next)
}

// ---------------------------------------------------------------------------

module.exports = reqValidatorsVideos
