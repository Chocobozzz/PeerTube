import { HttpStatusCode, VideoChannelActivityAction, VideoChannelSyncState } from '@peertube/peertube-models'
import { auditLoggerFactory, getAuditIdFromRes, VideoChannelSyncAuditView } from '@server/helpers/audit-logger.js'
import { logger } from '@server/helpers/logger.js'
import { sequelizeTypescript } from '@server/initializers/database.js'
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

const videoChannelSyncRouter = express.Router()
const auditLogger = auditLoggerFactory('channel-syncs')

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
    state: VideoChannelSyncState.WAITING_FIRST_RUN
  })

  await sequelizeTypescript.transaction(async transaction => {
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

  auditLogger.create(getAuditIdFromRes(res), new VideoChannelSyncAuditView(syncCreated.toFormattedJSON()))

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

  await sequelizeTypescript.transaction(async transaction => {
    await syncInstance.destroy({ transaction })

    await VideoChannelActivityModel.addChannelSyncActivity({
      action: VideoChannelActivityAction.DELETE,
      user: res.locals.oauth.token.User,
      channel: res.locals.videoChannel,
      sync: syncInstance,
      transaction
    })
  })

  auditLogger.delete(getAuditIdFromRes(res), new VideoChannelSyncAuditView(syncInstance.toFormattedJSON()))

  logger.info(
    'Video synchronization for channel "%s" with external channel "%s" deleted.',
    syncInstance.VideoChannel.name,
    syncInstance.externalChannelUrl
  )

  return res.type('json').status(HttpStatusCode.NO_CONTENT_204).end()
}
