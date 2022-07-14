import { auditLoggerFactory, getAuditIdFromRes, VideoChannelSyncAuditView } from '@server/helpers/audit-logger'
import { logger } from '@server/helpers/logger'
import { getFormattedObjects } from '@server/helpers/utils'
import { sequelizeTypescript } from '@server/initializers/database'
import {
  asyncMiddleware,
  asyncRetryTransactionMiddleware,
  authenticate,
  ensureCanManageChannel,
  ensureSyncExists,
  ensureSyncTargetChannelExists,
  setDefaultPagination,
  setDefaultSort,
  videoChannelSyncRemoveValidator,
  videoChannelSyncsSortValidator,
  videoChannelSyncValidator
} from '@server/middlewares'
import { VideoChannelModel } from '@server/models/video/video-channel'
import { VideoChannelSyncModel } from '@server/models/video/video-channel-sync'
import { HttpStatusCode, VideoChannelSyncState } from '@shared/models'
import express from 'express'

const videoChannelSyncRouter = express.Router()
const auditLogger = auditLoggerFactory('channels')

videoChannelSyncRouter.get('/me',
  authenticate,
  videoChannelSyncsSortValidator,
  setDefaultSort,
  setDefaultPagination,
  asyncMiddleware(listVideoChannelSyncs)
)

videoChannelSyncRouter.post('/',
  authenticate,
  videoChannelSyncValidator,
  ensureCanManageChannel,
  asyncRetryTransactionMiddleware(createVideoChannelSync)
)

videoChannelSyncRouter.delete('/:id',
  authenticate,
  videoChannelSyncRemoveValidator,
  asyncMiddleware(ensureSyncExists),
  asyncMiddleware(ensureSyncTargetChannelExists),
  ensureCanManageChannel,
  asyncRetryTransactionMiddleware(removeVideoChannelSync)
)

export { videoChannelSyncRouter }

// ---------------------------------------------------------------------------

async function listVideoChannelSyncs (req: express.Request, res: express.Response) {
  const user = res.locals.oauth.token.User
  const resultList = await VideoChannelSyncModel.listByAccountForAPI({
    accountId: user.Account.id,
    start: req.query.start,
    count: req.query.count,
    sort: req.query.sort
  })

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

async function createVideoChannelSync (req: express.Request, res: express.Response) {
  const syncCreated = new VideoChannelSyncModel({
    externalChannelUrl: req.body.externalChannelUrl,
    videoChannel: req.body.videoChannel,
    state: VideoChannelSyncState.SYNCED
  })
  await sequelizeTypescript.transaction(async t => {
    await syncCreated.save({ transaction: t })
    await syncCreated.reload({ transaction: t, include: VideoChannelModel })
  })
  auditLogger.create(getAuditIdFromRes(res), new VideoChannelSyncAuditView(syncCreated.toFormattedJSON()))
  logger.info(
    'Video synchronization for channel %s with external channel %s created.',
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
    'Video synchronization for channel %s with external channel %s deleted.',
    syncInstance.VideoChannel.name,
    syncInstance.externalChannelUrl
  )
  return res.type('json').status(HttpStatusCode.NO_CONTENT_204).end()
}
