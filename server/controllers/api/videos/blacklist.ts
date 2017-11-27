import * as express from 'express'

import { database as db } from '../../../initializers'
import { logger, getFormattedObjects } from '../../../helpers'
import {
  authenticate,
  ensureUserHasRight,
  videosBlacklistAddValidator,
  videosBlacklistRemoveValidator,
  paginationValidator,
  blacklistSortValidator,
  setBlacklistSort,
  setPagination,
  asyncMiddleware
} from '../../../middlewares'
import { BlacklistedVideoInstance } from '../../../models'
import { BlacklistedVideo, UserRight } from '../../../../shared'

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
  setPagination,
  asyncMiddleware(listBlacklist)
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

async function addVideoToBlacklist (req: express.Request, res: express.Response, next: express.NextFunction) {
  const videoInstance = res.locals.video

  const toCreate = {
    videoId: videoInstance.id
  }

  await db.BlacklistedVideo.create(toCreate)
  return res.type('json').status(204).end()
}

async function listBlacklist (req: express.Request, res: express.Response, next: express.NextFunction) {
  const resultList = await db.BlacklistedVideo.listForApi(req.query.start, req.query.count, req.query.sort)

  return res.json(getFormattedObjects<BlacklistedVideo, BlacklistedVideoInstance>(resultList.data, resultList.total))
}

async function removeVideoFromBlacklistController (req: express.Request, res: express.Response, next: express.NextFunction) {
  const blacklistedVideo = res.locals.blacklistedVideo as BlacklistedVideoInstance

  try {
    await blacklistedVideo.destroy()

    logger.info('Video %s removed from blacklist.', res.locals.video.uuid)

    return res.sendStatus(204)
  } catch (err) {
    logger.error('Some error while removing video %s from blacklist.', res.locals.video.uuid, err)
    throw err
  }
}
