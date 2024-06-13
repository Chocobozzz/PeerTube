import { VideoTranscriptionPayload } from '@peertube/peertube-models'
import { generateSubtitle } from '@server/lib/video-captions.js'
import { Job } from 'bullmq'
import { logger, loggerTagsFactory } from '../../../helpers/logger.js'
import { VideoModel } from '../../../models/video/video.js'

const lTags = loggerTagsFactory('transcription')

export async function processVideoTranscription (job: Job) {
  const payload = job.data as VideoTranscriptionPayload

  logger.info('Processing video transcription in job %s.', job.id)

  const video = await VideoModel.load(payload.videoUUID)
  if (!video) {
    logger.info('Do not process transcription job %d, video does not exist.', job.id, lTags(payload.videoUUID))
    return
  }

  return generateSubtitle({ video })
}
