'use strict'

const mongoose = require('mongoose')

const checkErrors = require('./utils').checkErrors
const constants = require('../../initializers/constants')
const customValidators = require('../../helpers/custom-validators')
const logger = require('../../helpers/logger')

const Video = mongoose.model('Video')

const validatorsVideos = {
  videosAdd: videosAdd,
  videosGet: videosGet,
  videosRemove: videosRemove,
  videosSearch: videosSearch
}

function videosAdd (req, res, next) {
  req.checkFiles('videofile[0].originalname', 'Should have an input video').notEmpty()
  req.checkFiles('videofile[0].mimetype', 'Should have a correct mime type').matches(/video\/(webm)|(mp4)|(ogg)/i)
  req.checkBody('name', 'Should have a valid name').isVideoNameValid()
  req.checkBody('description', 'Should have a valid description').isVideoDescriptionValid()
  req.checkBody('tags', 'Should have correct tags').isVideoTagsValid()

  logger.debug('Checking videosAdd parameters', { parameters: req.body, files: req.files })

  checkErrors(req, res, function () {
    const videoFile = req.files.videofile[0]

    Video.getDurationFromFile(videoFile.path, function (err, duration) {
      if (err) {
        return res.status(400).send('Cannot retrieve metadata of the file.')
      }

      if (!customValidators.isVideoDurationValid(duration)) {
        return res.status(400).send('Duration of the video file is too big (max: ' + constants.VIDEOS_CONSTRAINTS_FIELDS.DURATION.max + 's).')
      }

      videoFile.duration = duration
      next()
    })
  })
}

function videosGet (req, res, next) {
  req.checkParams('id', 'Should have a valid id').notEmpty().isMongoId()

  logger.debug('Checking videosGet parameters', { parameters: req.params })

  checkErrors(req, res, function () {
    Video.load(req.params.id, function (err, video) {
      if (err) {
        logger.error('Error in videosGet request validator.', { error: err })
        return res.sendStatus(500)
      }

      if (!video) return res.status(404).send('Video not found')

      next()
    })
  })
}

function videosRemove (req, res, next) {
  req.checkParams('id', 'Should have a valid id').notEmpty().isMongoId()

  logger.debug('Checking videosRemove parameters', { parameters: req.params })

  checkErrors(req, res, function () {
    Video.load(req.params.id, function (err, video) {
      if (err) {
        logger.error('Error in videosRemove request validator.', { error: err })
        return res.sendStatus(500)
      }

      if (!video) return res.status(404).send('Video not found')
      else if (video.isOwned() === false) return res.status(403).send('Cannot remove video of another pod')

      next()
    })
  })
}

function videosSearch (req, res, next) {
  const searchableColumns = constants.SEARCHABLE_COLUMNS.VIDEOS
  req.checkParams('value', 'Should have a valid search').notEmpty()
  req.checkQuery('field', 'Should have correct searchable column').optional().isIn(searchableColumns)

  logger.debug('Checking videosSearch parameters', { parameters: req.params })

  checkErrors(req, res, next)
}

// ---------------------------------------------------------------------------

module.exports = validatorsVideos
