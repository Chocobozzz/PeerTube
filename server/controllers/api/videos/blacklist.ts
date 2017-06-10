import * as express from 'express'

import { database as db } from '../../../initializers/database'
import { logger } from '../../../helpers'
import {
  authenticate,
  ensureIsAdmin,
  videosBlacklistValidator
} from '../../../middlewares'

const blacklistRouter = express.Router()

blacklistRouter.post('/:id/blacklist',
  authenticate,
  ensureIsAdmin,
  videosBlacklistValidator,
  addVideoToBlacklist
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

  db.BlacklistedVideo.create(toCreate).asCallback(function (err) {
    if (err) {
      logger.error('Errors when blacklisting video ', { error: err })
      return next(err)
    }

    return res.type('json').status(204).end()
  })
}
