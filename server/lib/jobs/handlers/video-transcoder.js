'use strict'

const db = require('../../../initializers/database')
const logger = require('../../../helpers/logger')

const VideoTranscoderHandler = {
  process,
  onError,
  onSuccess
}

// ---------------------------------------------------------------------------

function process (data, callback) {
  db.Video.load(data.id, function (err, video) {
    if (err) return callback(err)

    video.transcodeVideofile(callback)
  })
}

function onError (err, jobId, callback) {
  logger.error('Error when transcoding video file in job %d.', jobId, { error: err })
  return callback()
}

function onSuccess (data, jobId, callback) {
  logger.info('Job %d is a success.', jobId)
  return callback()
}

// ---------------------------------------------------------------------------

module.exports = VideoTranscoderHandler
