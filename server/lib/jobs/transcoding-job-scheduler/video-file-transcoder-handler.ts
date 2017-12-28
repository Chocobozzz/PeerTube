import { VideoResolution } from '../../../../shared'
import { VideoPrivacy } from '../../../../shared/models/videos'
import { logger } from '../../../helpers/logger'
import { VideoModel } from '../../../models/video/video'
import { sendUpdateVideo } from '../../activitypub/send'

async function process (data: { videoUUID: string, resolution: VideoResolution }, jobId: number) {
  const video = await VideoModel.loadByUUIDAndPopulateAccountAndServerAndTags(data.videoUUID)
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

async function onSuccess (jobId: number, video: VideoModel) {
  if (video === undefined) return undefined

  logger.info('Job %d is a success.', jobId)

  // Maybe the video changed in database, refresh it
  const videoDatabase = await VideoModel.loadByUUIDAndPopulateAccountAndServerAndTags(video.uuid)
  // Video does not exist anymore
  if (!videoDatabase) return undefined

  if (video.privacy !== VideoPrivacy.PRIVATE) {
    await sendUpdateVideo(video, undefined)
  }

  return undefined
}

// ---------------------------------------------------------------------------

export {
  process,
  onError,
  onSuccess
}
