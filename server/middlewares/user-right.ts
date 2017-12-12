import * as express from 'express'
import 'express-validator'
import { UserRight } from '../../shared'
import { logger } from '../helpers'
import { UserModel } from '../models/account/user'

function ensureUserHasRight (userRight: UserRight) {
  return function (req: express.Request, res: express.Response, next: express.NextFunction) {
    const user = res.locals.oauth.token.user as UserModel
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
