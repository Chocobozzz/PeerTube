import * as express from 'express'

import { database as db } from '../../../initializers'
import { logger, getFormattedObjects } from '../../../helpers'
import {
  authenticate,
  ensureIsAdmin,
  videosBlacklistAddValidator,
  videosBlacklistRemoveValidator,
  paginationValidator,
  blacklistSortValidator,
  setBlacklistSort,
  setPagination
} from '../../../middlewares'
import { BlacklistedVideoInstance } from '../../../models'
import { BlacklistedVideo } from '../../../../shared'

const blacklistRouter = express.Router()

blacklistRouter.post('/:videoId/blacklist',
  authenticate,
  ensureIsAdmin,
  videosBlacklistAddValidator,
  addVideoToBlacklist
)

blacklistRouter.get('/blacklist',
  authenticate,
  ensureIsAdmin,
  paginationValidator,
  blacklistSortValidator,
  setBlacklistSort,
  setPagination,
  listBlacklist
)

blacklistRouter.delete('/:videoId/blacklist',
  authenticate,
  ensureIsAdmin,
  videosBlacklistRemoveValidator,
  removeVideoFromBlacklistController
)

// ---------------------------------------------------------------------------

export {
  blacklistRouter
}

// ---------------------------------------------------------------------------

function addVideoToBlacklist (req: express.Request, res: express.Response, next: express.NextFunction) {
  const videoInstance = res.locals.video

  const toCreate = {
    videoId: videoInstance.id
  }

  db.BlacklistedVideo.create(toCreate)
    .then(() => res.type('json').status(204).end())
    .catch(err => {
      logger.error('Errors when blacklisting video ', err)
      return next(err)
    })
}

function listBlacklist (req: express.Request, res: express.Response, next: express.NextFunction) {
  db.BlacklistedVideo.listForApi(req.query.start, req.query.count, req.query.sort)
    .then(resultList => res.json(getFormattedObjects<BlacklistedVideo, BlacklistedVideoInstance>(resultList.data, resultList.total)))
    .catch(err => next(err))
}

function removeVideoFromBlacklistController (req: express.Request, res: express.Response, next: express.NextFunction) {
  const blacklistedVideo = res.locals.blacklistedVideo as BlacklistedVideoInstance

  blacklistedVideo.destroy()
    .then(() => {
      logger.info('Video %s removed from blacklist.', res.locals.video.uuid)
      res.sendStatus(204)
    })
    .catch(err => {
      logger.error('Some error while removing video %s from blacklist.', res.locals.video.uuid, err)
      next(err)
    })
}
