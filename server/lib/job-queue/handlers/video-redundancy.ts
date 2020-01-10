import * as Bull from 'bull'
import { logger } from '../../../helpers/logger'
import { VideosRedundancyScheduler } from '@server/lib/schedulers/videos-redundancy-scheduler'

export type VideoRedundancyPayload = {
  videoId: number
}

async function processVideoRedundancy (job: Bull.Job) {
  const payload = job.data as VideoRedundancyPayload
  logger.info('Processing video redundancy in job %d.', job.id)

  return VideosRedundancyScheduler.Instance.createManualRedundancy(payload.videoId)
}

// ---------------------------------------------------------------------------

export {
  processVideoRedundancy
}
