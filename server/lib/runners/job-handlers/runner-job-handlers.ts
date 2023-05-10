import { MRunnerJob } from '@server/types/models/runners'
import { RunnerJobSuccessPayload, RunnerJobType, RunnerJobUpdatePayload } from '@shared/models'
import { AbstractJobHandler } from './abstract-job-handler'
import { LiveRTMPHLSTranscodingJobHandler } from './live-rtmp-hls-transcoding-job-handler'
import { VideoStudioTranscodingJobHandler } from './video-studio-transcoding-job-handler'
import { VODAudioMergeTranscodingJobHandler } from './vod-audio-merge-transcoding-job-handler'
import { VODHLSTranscodingJobHandler } from './vod-hls-transcoding-job-handler'
import { VODWebVideoTranscodingJobHandler } from './vod-web-video-transcoding-job-handler'

const processors: Record<RunnerJobType, new() => AbstractJobHandler<unknown, RunnerJobUpdatePayload, RunnerJobSuccessPayload>> = {
  'vod-web-video-transcoding': VODWebVideoTranscodingJobHandler,
  'vod-hls-transcoding': VODHLSTranscodingJobHandler,
  'vod-audio-merge-transcoding': VODAudioMergeTranscodingJobHandler,
  'live-rtmp-hls-transcoding': LiveRTMPHLSTranscodingJobHandler,
  'video-studio-transcoding': VideoStudioTranscodingJobHandler
}

export function getRunnerJobHandlerClass (job: MRunnerJob) {
  return processors[job.type]
}
