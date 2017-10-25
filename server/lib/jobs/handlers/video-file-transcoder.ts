import { database as db } from '../../../initializers/database'
import { updateVideoToFriends } from '../../friends'
import { logger } from '../../../helpers'
import { VideoInstance } from '../../../models'
import { VideoResolution } from '../../../../shared'

async function process (data: { videoUUID: string, resolution: VideoResolution }, jobId: number) {
  const video = await db.Video.loadByUUIDAndPopulateAuthorAndPodAndTags(data.videoUUID)
  // No video, maybe deleted?
  if (!video) {
    logger.info('Do not process job %d, video does not exist.', jobId, { videoUUID: video.uuid })
    return undefined
  }

  await video.transcodeOriginalVideofile(data.resolution)

  return video
}

function onError (err: Error, jobId: number) {
  logger.error('Error when transcoding video file in job %d.', jobId, err)
  return Promise.resolve()
}

function onSuccess (jobId: number, video: VideoInstance) {
  if (video === undefined) return undefined

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
