import { CONFIG } from '@server/initializers/config.js'
import { MUserId, MVideoFile, MVideoFull } from '@server/types/models/index.js'
import { TranscodingJobQueueBuilder, TranscodingRunnerJobBuilder } from './shared/index.js'

export function createOptimizeOrMergeAudioJobs (options: {
  video: MVideoFull
  videoFile: MVideoFile
  isNewVideo: boolean
  user: MUserId
}) {
  return getJobBuilder().createOptimizeOrMergeAudioJobs(options)
}

// ---------------------------------------------------------------------------

export function createTranscodingJobs (options: {
  transcodingType: 'hls' | 'web-video'
  video: MVideoFull
  resolutions: number[]
  isNewVideo: boolean
  user: MUserId
}) {
  return getJobBuilder().createTranscodingJobs(options)
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

function getJobBuilder () {
  if (CONFIG.TRANSCODING.REMOTE_RUNNERS.ENABLED === true) {
    return new TranscodingRunnerJobBuilder()
  }

  return new TranscodingJobQueueBuilder()
}
