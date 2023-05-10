import { logger } from 'packages/peertube-runner/shared/logger'
import {
  RunnerJobLiveRTMPHLSTranscodingPayload,
  RunnerJobStudioTranscodingPayload,
  RunnerJobVODAudioMergeTranscodingPayload,
  RunnerJobVODHLSTranscodingPayload,
  RunnerJobVODWebVideoTranscodingPayload
} from '@shared/models'
import { processAudioMergeTranscoding, processHLSTranscoding, ProcessOptions, processWebVideoTranscoding } from './shared'
import { ProcessLiveRTMPHLSTranscoding } from './shared/process-live'
import { processStudioTranscoding } from './shared/process-studio'

export async function processJob (options: ProcessOptions) {
  const { server, job } = options

  logger.info(`[${server.url}] Processing job of type ${job.type}: ${job.uuid}`, { payload: job.payload })

  if (job.type === 'vod-audio-merge-transcoding') {
    await processAudioMergeTranscoding(options as ProcessOptions<RunnerJobVODAudioMergeTranscodingPayload>)
  } else if (job.type === 'vod-web-video-transcoding') {
    await processWebVideoTranscoding(options as ProcessOptions<RunnerJobVODWebVideoTranscodingPayload>)
  } else if (job.type === 'vod-hls-transcoding') {
    await processHLSTranscoding(options as ProcessOptions<RunnerJobVODHLSTranscodingPayload>)
  } else if (job.type === 'live-rtmp-hls-transcoding') {
    await new ProcessLiveRTMPHLSTranscoding(options as ProcessOptions<RunnerJobLiveRTMPHLSTranscodingPayload>).process()
  } else if (job.type === 'video-studio-transcoding') {
    await processStudioTranscoding(options as ProcessOptions<RunnerJobStudioTranscodingPayload>)
  } else {
    logger.error(`Unknown job ${job.type} to process`)
    return
  }

  logger.info(`[${server.url}] Finished processing job of type ${job.type}: ${job.uuid}`)
}
