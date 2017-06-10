import { database as db } from '../../../initializers/database'
import { logger } from '../../../helpers'
import { addVideoToFriends } from '../../../lib'
import { VideoInstance } from '../../../models'

function process (data: { id: string }, callback: (err: Error, videoInstance?: VideoInstance) => void) {
  db.Video.loadAndPopulateAuthorAndPodAndTags(data.id, function (err, video) {
    if (err) return callback(err)

    video.transcodeVideofile(function (err) {
      return callback(err, video)
    })
  })
}

function onError (err: Error, jobId: number, video: VideoInstance, callback: () => void) {
  logger.error('Error when transcoding video file in job %d.', jobId, { error: err })
  return callback()
}

function onSuccess (data: any, jobId: number, video: VideoInstance, callback: (err: Error) => void) {
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
