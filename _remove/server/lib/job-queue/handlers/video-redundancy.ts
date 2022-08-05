import { Job } from 'bull'
import { VideosRedundancyScheduler } from '@server/lib/schedulers/videos-redundancy-scheduler'
import { VideoRedundancyPayload } from '@shared/models'
import { logger } from '../../../helpers/logger'

async function processVideoRedundancy (job: Job) {
  const payload = job.data as VideoRedundancyPayload
  logger.info('Processing video redundancy in job %d.', job.id)

  return VideosRedundancyScheduler.Instance.createManualRedundancy(payload.videoId)
}

// ---------------------------------------------------------------------------

export {
  processVideoRedundancy
}
