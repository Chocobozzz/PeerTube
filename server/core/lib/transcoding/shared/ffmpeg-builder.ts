import { FFmpegVOD } from '@peertube/peertube-ffmpeg'
import { getFFmpegCommandWrapperOptions } from '@server/helpers/ffmpeg/index.js'
import { logger } from '@server/helpers/logger.js'
import { Job } from 'bullmq'
import { VideoTranscodingProfilesManager } from '../default-transcoding-profiles.js'

export function buildFFmpegVOD (options: {
  job?: Job
  abortSignal?: AbortSignal
} = {}) {
  const { job, abortSignal } = options

  return new FFmpegVOD({
    ...getFFmpegCommandWrapperOptions('vod', VideoTranscodingProfilesManager.Instance.getAvailableEncoders()),

    updateJobProgress: progress => {
      if (!job) return

      job.updateProgress(progress)
        .catch(err => logger.error('Cannot update ffmpeg job progress', { err }))
    },

    // Pass the abort signal from the job so the ffmpeg process can be killed on timeout
    abortSignal
  })
}
