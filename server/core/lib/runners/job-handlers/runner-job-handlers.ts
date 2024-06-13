import { RunnerJobSuccessPayload, RunnerJobType, RunnerJobUpdatePayload } from '@peertube/peertube-models'
import { MRunnerJob } from '@server/types/models/runners/index.js'
import { AbstractJobHandler } from './abstract-job-handler.js'
import { LiveRTMPHLSTranscodingJobHandler } from './live-rtmp-hls-transcoding-job-handler.js'
import { TranscriptionJobHandler } from './transcription-job-handler.js'
import { VideoStudioTranscodingJobHandler } from './video-studio-transcoding-job-handler.js'
import { VODAudioMergeTranscodingJobHandler } from './vod-audio-merge-transcoding-job-handler.js'
import { VODHLSTranscodingJobHandler } from './vod-hls-transcoding-job-handler.js'
import { VODWebVideoTranscodingJobHandler } from './vod-web-video-transcoding-job-handler.js'

const processors: Record<RunnerJobType, new() => AbstractJobHandler<unknown, RunnerJobUpdatePayload, RunnerJobSuccessPayload>> = {
  'vod-web-video-transcoding': VODWebVideoTranscodingJobHandler,
  'vod-hls-transcoding': VODHLSTranscodingJobHandler,
  'vod-audio-merge-transcoding': VODAudioMergeTranscodingJobHandler,
  'live-rtmp-hls-transcoding': LiveRTMPHLSTranscodingJobHandler,
  'video-studio-transcoding': VideoStudioTranscodingJobHandler,
  'video-transcription': TranscriptionJobHandler
}

export function getRunnerJobHandlerClass (job: MRunnerJob) {
  return processors[job.type]
}
