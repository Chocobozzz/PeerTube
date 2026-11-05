import { HttpStatusCode, UserRight, VideoBlacklistCreate, VideoBlacklistUpdate } from '@peertube/peertube-models'
import { blacklistVideo, unblacklistVideo } from '@server/lib/video-blacklist.js'
import { auditLog, buildVideoBlockAuditEntity, getAuditActorFromRes } from '@server/lib/audit-log/index.js'
import express from 'express'
import { createLogger } from '../../../helpers/logger.js'
import { getFormattedObjects } from '../../../helpers/utils.js'
import { runTransaction } from '../../../helpers/database-utils.js'
import {
  asyncMiddleware,
  authenticate,
  blacklistSortValidator,
  ensureUserHasRight,
  openapiOperationDoc,
  paginationValidator,
  setBlacklistSort,
  setDefaultPagination,
  videosBlacklistAddValidator,
  videosBlacklistFiltersValidator,
  videosBlacklistRemoveValidator,
  videosBlacklistUpdateValidator
} from '../../../middlewares/index.js'
import { VideoBlacklistModel } from '../../../models/video/video-blacklist.js'

const logger = createLogger()

const blacklistRouter = express.Router()

blacklistRouter.post(
  '/:videoId/blacklist',
  openapiOperationDoc({ operationId: 'addVideoBlock' }),
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_VIDEO_BLACKLIST),
  asyncMiddleware(videosBlacklistAddValidator),
  asyncMiddleware(addVideoToBlacklistController)
)

blacklistRouter.get(
  '/blacklist',
  openapiOperationDoc({ operationId: 'getVideoBlocks' }),
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_VIDEO_BLACKLIST),
  paginationValidator,
  blacklistSortValidator,
  setBlacklistSort,
  setDefaultPagination,
  videosBlacklistFiltersValidator,
  asyncMiddleware(listBlacklist)
)

blacklistRouter.put(
  '/:videoId/blacklist',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_VIDEO_BLACKLIST),
  asyncMiddleware(videosBlacklistUpdateValidator),
  asyncMiddleware(updateVideoBlacklistController)
)

blacklistRouter.delete(
  '/:videoId/blacklist',
  openapiOperationDoc({ operationId: 'delVideoBlock' }),
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_VIDEO_BLACKLIST),
  asyncMiddleware(videosBlacklistRemoveValidator),
  asyncMiddleware(removeVideoFromBlacklistController)
)

// ---------------------------------------------------------------------------

export {
  blacklistRouter
}

// ---------------------------------------------------------------------------

async function addVideoToBlacklistController (req: express.Request, res: express.Response) {
  const videoInstance = res.locals.videoWithRights
  const body: VideoBlacklistCreate = req.body

  await logger.withContext([ videoInstance.uuid ], async () => {
    const videoBlock = await blacklistVideo(videoInstance, body)

    auditLog.create(getAuditActorFromRes(res), () => buildVideoBlockAuditEntity({ video: videoInstance, videoBlock }))

    logger.info('Video %s blacklisted.', videoInstance.uuid)

    return res.type('json').status(HttpStatusCode.NO_CONTENT_204).end()
  })
}

async function updateVideoBlacklistController (req: express.Request, res: express.Response) {
  const videoBlacklist = res.locals.videoBlacklist
  const video = res.locals.videoWithRights
  const body: VideoBlacklistUpdate = req.body

  const oldVideoBlockAuditEntity = auditLog.snapshot(() => buildVideoBlockAuditEntity({ video, videoBlock: videoBlacklist }))

  if (body.reason !== undefined) videoBlacklist.reason = body.reason
  if (body.internalNote !== undefined) videoBlacklist.internalNote = body.internalNote

  await runTransaction(t => {
    return videoBlacklist.save({ transaction: t })
  })

  auditLog.update(
    getAuditActorFromRes(res),
    () => buildVideoBlockAuditEntity({ video, videoBlock: videoBlacklist }),
    oldVideoBlockAuditEntity
  )

  return res.type('json').status(HttpStatusCode.NO_CONTENT_204).end()
}

async function listBlacklist (req: express.Request, res: express.Response) {
  const resultList = await VideoBlacklistModel.listForApi({
    start: req.query.start,
    count: req.query.count,
    sort: req.query.sort,
    search: req.query.search,
    type: req.query.type
  })

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

async function removeVideoFromBlacklistController (req: express.Request, res: express.Response) {
  const videoBlacklist = res.locals.videoBlacklist
  const video = res.locals.videoWithRights

  await unblacklistVideo(videoBlacklist, video)

  auditLog.delete(getAuditActorFromRes(res), () => buildVideoBlockAuditEntity({ video, videoBlock: videoBlacklist }))

  logger.info('Video %s removed from blacklist.', video.uuid)

  return res.type('json').status(HttpStatusCode.NO_CONTENT_204).end()
}
