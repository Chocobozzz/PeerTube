import { database as db } from '../../../initializers/database'
import { logger } from '../../../helpers'
import { addVideoToFriends } from '../../../lib'

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
    addVideoToFriends(remoteVideo, null, callback)
  })
}

// ---------------------------------------------------------------------------

export {
  process,
  onError,
  onSuccess
}
