import { Job } from 'bullmq'
import { retryTransactionWrapper } from '@server/helpers/database-utils.js'
import { sequelizeTypescript } from '@server/initializers/database.js'
import { federateVideoIfNeeded } from '@server/lib/activitypub/videos/index.js'
import { VideoModel } from '@server/models/video/video.js'
import { FederateVideoPayload } from '@peertube/peertube-models'
import { logger } from '../../../helpers/logger.js'

function processFederateVideo (job: Job) {
  const payload = job.data as FederateVideoPayload

  logger.info('Processing video federation in job %s.', job.id)

  return retryTransactionWrapper(() => {
    return sequelizeTypescript.transaction(async t => {
      const video = await VideoModel.loadFull(payload.videoUUID, t)
      if (!video) return

      return federateVideoIfNeeded(video, payload.isNewVideoForFederation, t)
    })
  })
}

// ---------------------------------------------------------------------------

export {
  processFederateVideo
}
