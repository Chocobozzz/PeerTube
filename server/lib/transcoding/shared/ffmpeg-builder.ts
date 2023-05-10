import { Job } from 'bullmq'
import { getFFmpegCommandWrapperOptions } from '@server/helpers/ffmpeg'
import { logger } from '@server/helpers/logger'
import { FFmpegVOD } from '@shared/ffmpeg'
import { VideoTranscodingProfilesManager } from '../default-transcoding-profiles'

export function buildFFmpegVOD (job?: Job) {
  return new FFmpegVOD({
    ...getFFmpegCommandWrapperOptions('vod', VideoTranscodingProfilesManager.Instance.getAvailableEncoders()),

    updateJobProgress: progress => {
      if (!job) return

      job.updateProgress(progress)
        .catch(err => logger.error('Cannot update ffmpeg job progress', { err }))
    }
  })
}
