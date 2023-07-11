import { CONFIG } from '@server/initializers/config'
import { MUserId, MVideoFile, MVideoFullLight } from '@server/types/models'
import { TranscodingJobQueueBuilder, TranscodingRunnerJobBuilder } from './shared'

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
  transcodingType: 'hls' | 'webtorrent' | 'web-video' // TODO: remove webtorrent in v7
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
