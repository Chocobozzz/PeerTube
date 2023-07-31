import { Job } from 'bullmq'
import { VideosRedundancyScheduler } from '@server/lib/schedulers/videos-redundancy-scheduler.js'
import { VideoRedundancyPayload } from '@peertube/peertube-models'
import { logger } from '../../../helpers/logger.js'

async function processVideoRedundancy (job: Job) {
  const payload = job.data as VideoRedundancyPayload
  logger.info('Processing video redundancy in job %s.', job.id)

  return VideosRedundancyScheduler.Instance.createManualRedundancy(payload.videoId)
}

// ---------------------------------------------------------------------------

export {
  processVideoRedundancy
}
