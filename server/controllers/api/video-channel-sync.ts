import { auditLoggerFactory, getAuditIdFromRes, VideoChannelSyncAuditView } from '@server/helpers/audit-logger'
import { logger } from '@server/helpers/logger'
import { sequelizeTypescript } from '@server/initializers/database'
import { JobQueue } from '@server/lib/job-queue'
import {
  asyncMiddleware,
  asyncRetryTransactionMiddleware,
  authenticate,
  ensureCanManageChannel as ensureCanManageSyncedChannel,
  ensureCanUpload,
  ensureSyncExists,
  ensureSyncIsEnabled,
  videoChannelSyncValidator
} from '@server/middlewares'
import { VideoChannelSyncModel } from '@server/models/video/video-channel-sync'
import { HttpStatusCode, VideoChannelSyncState } from '@shared/models'
import express from 'express'

const videoChannelSyncRouter = express.Router()
const auditLogger = auditLoggerFactory('channels')

videoChannelSyncRouter.post('/',
  authenticate,
  ensureSyncIsEnabled,
  asyncMiddleware(videoChannelSyncValidator),
  ensureCanManageSyncedChannel,
  asyncRetryTransactionMiddleware(createVideoChannelSync)
)

videoChannelSyncRouter.post('/:id/sync',
  authenticate,
  ensureSyncIsEnabled,
  asyncMiddleware(ensureSyncExists),
  ensureCanManageSyncedChannel,
  asyncMiddleware(ensureCanUpload),
  syncChannel
)

videoChannelSyncRouter.delete('/:id',
  authenticate,
  asyncMiddleware(ensureSyncExists),
  ensureCanManageSyncedChannel,
  asyncRetryTransactionMiddleware(removeVideoChannelSync)
)

export { videoChannelSyncRouter }

// ---------------------------------------------------------------------------

async function createVideoChannelSync (req: express.Request, res: express.Response) {
  const syncCreated = new VideoChannelSyncModel({
    externalChannelUrl: req.body.externalChannelUrl,
    videoChannelId: req.body.videoChannelId,
    state: VideoChannelSyncState.WAITING_FIRST_RUN
  })
  await sequelizeTypescript.transaction(async t => {
    await syncCreated.save({ transaction: t })
    await syncCreated.reload({ transaction: t })
  })
  auditLogger.create(getAuditIdFromRes(res), new VideoChannelSyncAuditView(syncCreated.toFormattedJSON()))
  logger.info(
    'Video synchronization for channel "%s" with external channel "%s" created.',
    syncCreated.VideoChannel.name,
    syncCreated.externalChannelUrl
  )

  return res.json({
    videoChannelSync: {
      id: syncCreated.id
    }
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

function syncChannel (req: express.Request, res: express.Response) {
  const { externalChannelUrl, videoChannelId } = res.locals.videoChannelSync
  JobQueue.Instance.createJob({
    type: 'video-channel-import',
    payload: {
      externalChannelUrl,
      videoChannelId
    }
  })
  logger.info(
    'Video import job for channel "%s" with external channel "%s" created.',
    res.locals.videoChannel.name,
    externalChannelUrl
  )
  return res.type('json').status(HttpStatusCode.NO_CONTENT_204).end()
}
