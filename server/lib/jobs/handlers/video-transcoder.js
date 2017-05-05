'use strict'

const db = require('../../../initializers/database')
const logger = require('../../../helpers/logger')
const friends = require('../../../lib/friends')

const VideoTranscoderHandler = {
  process,
  onError,
  onSuccess
}

// ---------------------------------------------------------------------------

function process (data, callback) {
  db.Video.loadAndPopulateAuthorAndPodAndTags(data.id, function (err, video) {
    if (err) return callback(err)

    video.transcodeVideofile(function (err) {
      return callback(err, video)
    })
  })
}

function onError (err, jobId, video, callback) {
  logger.error('Error when transcoding video file in job %d.', jobId, { error: err })
  return callback()
}

function onSuccess (data, jobId, video, callback) {
  logger.info('Job %d is a success.', jobId)

  video.toAddRemoteJSON(function (err, remoteVideo) {
    if (err) return callback(err)

    // Now we'll add the video's meta data to our friends
    friends.addVideoToFriends(remoteVideo, null, callback)
  })
}

// ---------------------------------------------------------------------------

module.exports = VideoTranscoderHandler
