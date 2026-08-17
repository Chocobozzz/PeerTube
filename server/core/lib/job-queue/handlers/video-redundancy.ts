import { Job } from 'bullmq'
import { VideosRedundancyScheduler } from '@server/lib/schedulers/videos-redundancy-scheduler.js'
import { VideoRedundancyPayload } from '@peertube/peertube-models'
import { createLogger } from '../../../helpers/logger.js'

const logger = createLogger()

async function processVideoRedundancy (job: Job) {
  const payload = job.data as VideoRedundancyPayload
  logger.info('Processing video redundancy in job %s.', job.id)

  return VideosRedundancyScheduler.Instance.createManualRedundancy(payload.videoId)
}

// ---------------------------------------------------------------------------

export {
  processVideoRedundancy
}
