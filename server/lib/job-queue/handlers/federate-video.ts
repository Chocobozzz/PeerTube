import { Job } from 'bullmq'
import { retryTransactionWrapper } from '@server/helpers/database-utils'
import { sequelizeTypescript } from '@server/initializers/database'
import { federateVideoIfNeeded } from '@server/lib/activitypub/videos'
import { VideoModel } from '@server/models/video/video'
import { FederateVideoPayload } from '@shared/models'
import { logger } from '../../../helpers/logger'

function processFederateVideo (job: Job) {
  const payload = job.data as FederateVideoPayload

  logger.info('Processing video federation in job %s.', job.id)

  return retryTransactionWrapper(() => {
    return sequelizeTypescript.transaction(async t => {
      const video = await VideoModel.loadFull(payload.videoUUID, t)
      if (!video) return

      return federateVideoIfNeeded(video, payload.isNewVideo, t)
    })
  })
}

// ---------------------------------------------------------------------------

export {
  processFederateVideo
}
