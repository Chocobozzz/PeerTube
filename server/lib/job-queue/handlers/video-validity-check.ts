import { Job } from 'bull'
import { checkValidity } from '@server/helpers/ffmpeg/ffmpeg-validate'
import { logger, loggerTagsFactory } from '@server/helpers/logger'
import { VideoModel } from '@server/models/video/video'
import { VideoStreamingPlaylistType, VideoValidityCheckPayload } from '@shared/models'
import { moveToFailedTranscodingState } from '@server/lib/video-state'
import { Notifier } from '@server/lib/notifier'
import { getHLSDirectory } from '@server/lib/paths'
import { join } from 'path'

const lTags = loggerTagsFactory('transcoding')

async function processVideoValidityCheck (job: Job) {
  const payload = job.data as VideoValidityCheckPayload

  logger.info('Processing video validity check for video %s',
    payload.videoUUID,
    lTags(payload.videoUUID)
  )

  const video = await VideoModel.loadAndPopulateAccountAndServerAndTags(payload.videoUUID)
  const videoFiles = video.VideoStreamingPlaylists.find(v => v.type === VideoStreamingPlaylistType.HLS).VideoFiles

  for (const videoFile of videoFiles) {
    const filePath = join(getHLSDirectory(video), videoFile.filename)

    try {
      await checkValidity({
        job,
        path: filePath
      })
    } catch (err) {
      logger.error('Video validity check failed for resolution %s in video %s',
        videoFile.resolution,
        payload.videoUUID,
        lTags(payload.videoUUID)
      )
      await moveToFailedTranscodingState(video)
      Notifier.Instance.notifyOnVideoValidationFailed(video)
      break
    }
  }
}

export {
  processVideoValidityCheck
}
