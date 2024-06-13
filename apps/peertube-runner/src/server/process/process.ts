import {
  RunnerJobLiveRTMPHLSTranscodingPayload,
  RunnerJobStudioTranscodingPayload,
  RunnerJobTranscriptionPayload,
  RunnerJobVODAudioMergeTranscodingPayload,
  RunnerJobVODHLSTranscodingPayload,
  RunnerJobVODWebVideoTranscodingPayload
} from '@peertube/peertube-models'
import { logger } from '../../shared/index.js'
import { processAudioMergeTranscoding, processHLSTranscoding, ProcessOptions, processWebVideoTranscoding } from './shared/index.js'
import { ProcessLiveRTMPHLSTranscoding } from './shared/process-live.js'
import { processStudioTranscoding } from './shared/process-studio.js'
import { processVideoTranscription } from './shared/process-transcription.js'

export async function processJob (options: ProcessOptions) {
  const { server, job } = options

  logger.info(`[${server.url}] Processing job of type ${job.type}: ${job.uuid}`, { payload: job.payload })

  switch (job.type) {
    case 'vod-audio-merge-transcoding':
      await processAudioMergeTranscoding(options as ProcessOptions<RunnerJobVODAudioMergeTranscodingPayload>)
      break

    case 'vod-web-video-transcoding':
      await processWebVideoTranscoding(options as ProcessOptions<RunnerJobVODWebVideoTranscodingPayload>)
      break

    case 'vod-hls-transcoding':
      await processHLSTranscoding(options as ProcessOptions<RunnerJobVODHLSTranscodingPayload>)
      break

    case 'live-rtmp-hls-transcoding':
      await new ProcessLiveRTMPHLSTranscoding(options as ProcessOptions<RunnerJobLiveRTMPHLSTranscodingPayload>).process()
      break

    case 'video-studio-transcoding':
      await processStudioTranscoding(options as ProcessOptions<RunnerJobStudioTranscodingPayload>)
      break

    case 'video-transcription':
      await processVideoTranscription(options as ProcessOptions<RunnerJobTranscriptionPayload>)
      break

    default:
      logger.error(`Unknown job ${job.type} to process`)
      return
  }

  logger.info(`[${server.url}] Finished processing job of type ${job.type}: ${job.uuid}`)
}
