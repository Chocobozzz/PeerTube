import { VideoTranscriptionPayload } from '@peertube/peertube-models'
import { runTranscription } from '@server/lib/transcription/video-transcription.js'
import { Job } from 'bullmq'
import { createLogger } from '../../../helpers/logger.js'
import { VideoModel } from '../../../models/video/video.js'
import { buildPromiseForAbortSignal } from './shared/job-helpers.js'

const logger = createLogger('transcription')

export async function processVideoTranscription (job: Job, abortSignal?: AbortSignal) {
  const abortPromise = buildPromiseForAbortSignal(abortSignal)

  const run = async () => {
    const payload = job.data as VideoTranscriptionPayload

    await logger.withContext([ payload.videoUUID ], async () => {
      logger.info('Processing video transcription in job %s.', job.id)

      const video = await VideoModel.load(payload.videoUUID)
      if (!video) {
        logger.info('Do not process transcription job %d, video does not exist.', job.id)
        return
      }

      return runTranscription({ video, signal: abortSignal })
    })
  }

  return Promise.race([ run(), abortPromise ])
}
