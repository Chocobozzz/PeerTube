import 'express-validator'
import * as express from 'express'

import { UserInstance } from '../models'
import { UserRight } from '../../shared'
import { logger } from '../helpers'

function ensureUserHasRight (userRight: UserRight) {
  return function (req: express.Request, res: express.Response, next: express.NextFunction) {
    const user: UserInstance = res.locals.oauth.token.user
    if (user.hasRight(userRight) === false) {
      logger.info('User %s does not have right %s to access to %s.', user.username, UserRight[userRight], req.path)
      return res.sendStatus(403)
    }

    return next()
  }
}

// ---------------------------------------------------------------------------

export {
  ensureUserHasRight
}
