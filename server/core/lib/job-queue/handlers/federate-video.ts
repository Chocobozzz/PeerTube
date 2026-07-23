import { FederateVideoPayload } from '@peertube/peertube-models'
import { retryTransactionWrapper } from '@server/helpers/database-utils.js'
import { sequelizeTypescript } from '@server/initializers/database.js'
import { federateVideoIfNeeded } from '@server/lib/activitypub/videos/index.js'
import { ActorModel } from '@server/models/actor/actor.js'
import { VideoModel } from '@server/models/video/video.js'
import { Job } from 'bullmq'
import { logger } from '../../../helpers/logger.js'

export function processFederateVideo (job: Job) {
  const payload = job.data as FederateVideoPayload

  logger.info('Processing video federation in job %s.', job.id)

  return retryTransactionWrapper(() => {
    return sequelizeTypescript.transaction(async t => {
      const video = await VideoModel.loadAP(payload.videoUUID, t)
      if (!video) return

      const overriddenByActor = payload.overriddenByActorId
        ? await ActorModel.loadFull(payload.overriddenByActorId, t)
        : undefined

      return federateVideoIfNeeded({ video, overriddenByActor, transaction: t })
    })
  })
}
