import * as express from 'express'

import { database } from '../../initializers'
import { getFormattedObjects } from '../../helpers'
import { BlacklistedVideo } from '../../../shared'
import { BlacklistedVideoInstance } from '../../models'

import {
  removeVideoFromBlacklist
} from '../../lib'
import {
  authenticate,
  ensureIsAdmin,
  paginationValidator,
  blacklistSortValidator,
  setBlacklistSort,
  setPagination,
  blacklistRemoveValidator
} from '../../middlewares'

const blacklistRouter = express.Router()

blacklistRouter.get('/',
  authenticate,
  ensureIsAdmin,
  paginationValidator,
  blacklistSortValidator,
  setBlacklistSort,
  setPagination,
  listBlacklist
)

blacklistRouter.delete('/:id',
  authenticate,
  ensureIsAdmin,
  blacklistRemoveValidator,
  removeVideoFromBlacklistController
)

// ---------------------------------------------------------------------------

export {
  blacklistRouter
}

// ---------------------------------------------------------------------------

function listBlacklist (req: express.Request, res: express.Response, next: express.NextFunction) {
  database.BlacklistedVideo.listForApi(req.query.start, req.query.count, req.query.sort)
    .then(resultList => res.json(getFormattedObjects<BlacklistedVideo, BlacklistedVideoInstance>(resultList.data, resultList.total)))
    .catch(err => next(err))
}

function removeVideoFromBlacklistController (req: express.Request, res: express.Response, next: express.NextFunction) {
  const entry = res.locals.blacklistEntryToRemove as BlacklistedVideoInstance

  removeVideoFromBlacklist(entry)
    .then(() => res.sendStatus(204))
    .catch(err => next(err))
}
