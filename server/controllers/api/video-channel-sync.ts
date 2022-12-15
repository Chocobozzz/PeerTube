import express from 'express'
import { auditLoggerFactory, getAuditIdFromRes, VideoChannelSyncAuditView } from '@server/helpers/audit-logger'
import { logger } from '@server/helpers/logger'
import {
  asyncMiddleware,
  asyncRetryTransactionMiddleware,
  authenticate,
  ensureCanManageChannelOrAccount,
  ensureSyncExists,
  ensureSyncIsEnabled,
  videoChannelSyncValidator
} from '@server/middlewares'
import { VideoChannelSyncModel } from '@server/models/video/video-channel-sync'
import { MChannelSyncFormattable } from '@server/types/models'
import { HttpStatusCode, VideoChannelSyncState } from '@shared/models'

const videoChannelSyncRouter = express.Router()
const auditLogger = auditLoggerFactory('channel-syncs')

videoChannelSyncRouter.post('/',
  authenticate,
  ensureSyncIsEnabled,
  asyncMiddleware(videoChannelSyncValidator),
  ensureCanManageChannelOrAccount,
  asyncRetryTransactionMiddleware(createVideoChannelSync)
)

videoChannelSyncRouter.delete('/:id',
  authenticate,
  asyncMiddleware(ensureSyncExists),
  ensureCanManageChannelOrAccount,
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

  await syncCreated.save()
  syncCreated.VideoChannel = res.locals.videoChannel

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

  await syncInstance.destroy()

  auditLogger.delete(getAuditIdFromRes(res), new VideoChannelSyncAuditView(syncInstance.toFormattedJSON()))

  logger.info(
    'Video synchronization for channel "%s" with external channel "%s" deleted.',
    syncInstance.VideoChannel.name,
    syncInstance.externalChannelUrl
  )

  return res.type('json').status(HttpStatusCode.NO_CONTENT_204).end()
}
