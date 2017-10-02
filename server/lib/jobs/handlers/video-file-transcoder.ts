import { database as db } from '../../../initializers/database'
import { updateVideoToFriends } from '../../friends'
import { logger } from '../../../helpers'
import { VideoInstance } from '../../../models'
import { VideoResolution } from '../../../../shared'

function process (data: { videoUUID: string, resolution: VideoResolution }) {
  return db.Video.loadByUUIDAndPopulateAuthorAndPodAndTags(data.videoUUID).then(video => {
    return video.transcodeOriginalVideofile(data.resolution).then(() => video)
  })
}

function onError (err: Error, jobId: number) {
  logger.error('Error when transcoding video file in job %d.', jobId, err)
  return Promise.resolve()
}

function onSuccess (jobId: number, video: VideoInstance) {
  logger.info('Job %d is a success.', jobId)

  const remoteVideo = video.toUpdateRemoteJSON()

  // Now we'll add the video's meta data to our friends
  return updateVideoToFriends(remoteVideo, null)
}

// ---------------------------------------------------------------------------

export {
  process,
  onError,
  onSuccess
}
