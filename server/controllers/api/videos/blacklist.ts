import * as express from 'express'
import { VideoBlacklist, UserRight, VideoBlacklistCreate } from '../../../../shared'
import { logger } from '../../../helpers/logger'
import { getFormattedObjects } from '../../../helpers/utils'
import {
  asyncMiddleware,
  authenticate,
  blacklistSortValidator,
  ensureUserHasRight,
  paginationValidator,
  setBlacklistSort,
  setDefaultPagination,
  videosBlacklistAddValidator,
  videosBlacklistRemoveValidator,
  videosBlacklistUpdateValidator
} from '../../../middlewares'
import { VideoBlacklistModel } from '../../../models/video/video-blacklist'
import { sequelizeTypescript } from '../../../initializers'

const blacklistRouter = express.Router()

blacklistRouter.post('/:videoId/blacklist',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_VIDEO_BLACKLIST),
  asyncMiddleware(videosBlacklistAddValidator),
  asyncMiddleware(addVideoToBlacklist)
)

blacklistRouter.get('/blacklist',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_VIDEO_BLACKLIST),
  paginationValidator,
  blacklistSortValidator,
  setBlacklistSort,
  setDefaultPagination,
  asyncMiddleware(listBlacklist)
)

blacklistRouter.put('/:videoId/blacklist',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_VIDEO_BLACKLIST),
  asyncMiddleware(videosBlacklistUpdateValidator),
  asyncMiddleware(updateVideoBlacklistController)
)

blacklistRouter.delete('/:videoId/blacklist',
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

async function addVideoToBlacklist (req: express.Request, res: express.Response) {
  const videoInstance = res.locals.video
  const body: VideoBlacklistCreate = req.body

  const toCreate = {
    videoId: videoInstance.id,
    reason: body.reason
  }

  await VideoBlacklistModel.create(toCreate)
  return res.type('json').status(204).end()
}

async function updateVideoBlacklistController (req: express.Request, res: express.Response) {
  const videoBlacklist = res.locals.videoBlacklist as VideoBlacklistModel
  logger.info(videoBlacklist)

  if (req.body.reason !== undefined) videoBlacklist.reason = req.body.reason

  await sequelizeTypescript.transaction(t => {
    return videoBlacklist.save({ transaction: t })
  })

  return res.type('json').status(204).end()
}

async function listBlacklist (req: express.Request, res: express.Response, next: express.NextFunction) {
  const resultList = await VideoBlacklistModel.listForApi(req.query.start, req.query.count, req.query.sort)

  return res.json(getFormattedObjects<VideoBlacklist, VideoBlacklistModel>(resultList.data, resultList.total))
}

async function removeVideoFromBlacklistController (req: express.Request, res: express.Response, next: express.NextFunction) {
  const videoBlacklist = res.locals.videoBlacklist as VideoBlacklistModel

  await sequelizeTypescript.transaction(t => {
    return videoBlacklist.destroy({ transaction: t })
  })

  logger.info('Video %s removed from blacklist.', res.locals.video.uuid)

  return res.type('json').status(204).end()
}
