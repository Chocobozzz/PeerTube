import { HttpStatusCode, VideoChannelActivityAction, StreamSyncState } from '@peertube/peertube-models'
import { auditLog, buildChannelSyncAuditEntity, getAuditActorFromRes } from '@server/lib/audit-log/index.js'
import { createLogger } from '@server/helpers/logger.js'
import { runTransaction } from '@server/helpers/database-utils.js'
import {
  apiRateLimiter,
  asyncMiddleware,
  asyncRetryTransactionMiddleware,
  authenticate,
  ensureSyncExists,
  ensureSyncIsEnabled,
  videoChannelSyncValidator
} from '@server/middlewares/index.js'
import { VideoChannelActivityModel } from '@server/models/video/video-channel-activity.js'
import { VideoChannelSyncModel } from '@server/models/video/video-channel-sync.js'
import { MChannelSyncFormattable } from '@server/types/models/index.js'
import express from 'express'

const logger = createLogger()

const videoChannelSyncRouter = express.Router()

videoChannelSyncRouter.use(apiRateLimiter)

videoChannelSyncRouter.post(
  '/',
  authenticate,
  ensureSyncIsEnabled,
  asyncMiddleware(videoChannelSyncValidator),
  asyncRetryTransactionMiddleware(createVideoChannelSync)
)

videoChannelSyncRouter.delete(
  '/:id',
  authenticate,
  asyncMiddleware(ensureSyncExists),
  asyncRetryTransactionMiddleware(removeVideoChannelSync)
)

export { videoChannelSyncRouter }

// ---------------------------------------------------------------------------

async function createVideoChannelSync (req: express.Request, res: express.Response) {
  const syncCreated: MChannelSyncFormattable = new VideoChannelSyncModel({
    externalChannelUrl: req.body.externalChannelUrl,
    videoChannelId: req.body.videoChannelId,
    videoPrivacy: req.body.videoPrivacy,
    state: StreamSyncState.WAITING_FIRST_RUN
  })

  await runTransaction(async transaction => {
    await syncCreated.save({ transaction })
    syncCreated.VideoChannel = res.locals.videoChannel

    await VideoChannelActivityModel.addChannelSyncActivity({
      action: VideoChannelActivityAction.CREATE,
      user: res.locals.oauth.token.User,
      channel: res.locals.videoChannel,
      sync: syncCreated,
      transaction
    })
  })

  auditLog.create(getAuditActorFromRes(res), () => buildChannelSyncAuditEntity(syncCreated.toFormattedJSON()))

  logger.info(
    'Video synchronization for channel "%s" with external channel "%s" created.',
    syncCreated.VideoChannel.name,
    syncCreated.externalChannelUrl
  )

  return res.json({
    videoChannelSync: syncCreated.toFormattedJSON()
  })
}

async function removeVideoChannelSync (req: express.Request, res: express.Response) {
  const syncInstance = res.locals.videoChannelSync

  await runTransaction(async transaction => {
    await syncInstance.destroy({ transaction })

    await VideoChannelActivityModel.addChannelSyncActivity({
      action: VideoChannelActivityAction.DELETE,
      user: res.locals.oauth.token.User,
      channel: res.locals.videoChannel,
      sync: syncInstance,
      transaction
    })
  })

  auditLog.delete(getAuditActorFromRes(res), () => buildChannelSyncAuditEntity(syncInstance.toFormattedJSON()))

  logger.info(
    'Video synchronization for channel "%s" with external channel "%s" deleted.',
    syncInstance.VideoChannel.name,
    syncInstance.externalChannelUrl
  )

  return res.type('json').status(HttpStatusCode.NO_CONTENT_204).end()
}
