import express from 'express'
import { blacklistVideo, unblacklistVideo } from '@server/lib/video-blacklist.js'
import { HttpStatusCode, UserRight, VideoBlacklistCreate } from '@peertube/peertube-models'
import { logger } from '../../../helpers/logger.js'
import { getFormattedObjects } from '../../../helpers/utils.js'
import { sequelizeTypescript } from '../../../initializers/database.js'
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

const blacklistRouter = express.Router()

blacklistRouter.post('/:videoId/blacklist',
  openapiOperationDoc({ operationId: 'addVideoBlock' }),
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_VIDEO_BLACKLIST),
  asyncMiddleware(videosBlacklistAddValidator),
  asyncMiddleware(addVideoToBlacklistController)
)

blacklistRouter.get('/blacklist',
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

blacklistRouter.put('/:videoId/blacklist',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_VIDEO_BLACKLIST),
  asyncMiddleware(videosBlacklistUpdateValidator),
  asyncMiddleware(updateVideoBlacklistController)
)

blacklistRouter.delete('/:videoId/blacklist',
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
  const videoInstance = res.locals.videoAll
  const body: VideoBlacklistCreate = req.body

  await blacklistVideo(videoInstance, body)

  logger.info('Video %s blacklisted.', videoInstance.uuid)

  return res.type('json').status(HttpStatusCode.NO_CONTENT_204).end()
}

async function updateVideoBlacklistController (req: express.Request, res: express.Response) {
  const videoBlacklist = res.locals.videoBlacklist

  if (req.body.reason !== undefined) videoBlacklist.reason = req.body.reason

  await sequelizeTypescript.transaction(t => {
    return videoBlacklist.save({ transaction: t })
  })

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
  const video = res.locals.videoAll

  await unblacklistVideo(videoBlacklist, video)

  logger.info('Video %s removed from blacklist.', video.uuid)

  return res.type('json').status(HttpStatusCode.NO_CONTENT_204).end()
}
