import { CONFIG } from '@server/initializers/config.js'
import { MUserId, MVideoFile, MVideoFullLight } from '@server/types/models/index.js'
import { TranscodingJobQueueBuilder, TranscodingRunnerJobBuilder } from './shared/index.js'

export function createOptimizeOrMergeAudioJobs (options: {
  video: MVideoFullLight
  videoFile: MVideoFile
  isNewVideo: boolean
  user: MUserId
  videoFileAlreadyLocked: boolean
}) {
  return getJobBuilder().createOptimizeOrMergeAudioJobs(options)
}

// ---------------------------------------------------------------------------

export function createTranscodingJobs (options: {
  transcodingType: 'hls' | 'web-video'
  video: MVideoFullLight
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
