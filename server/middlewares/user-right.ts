import express from 'express'
import { HttpStatusCode, UserRight } from '@shared/models'
import { logger } from '../helpers/logger'

function ensureUserHasRight (userRight: UserRight) {
  return function (req: express.Request, res: express.Response, next: express.NextFunction) {
    const user = res.locals.oauth.token.user
    if (user.hasRight(userRight) === false) {
      const message = `User ${user.username} does not have right ${userRight} to access to ${req.path}.`
      logger.info(message)

      return res.fail({
        status: HttpStatusCode.FORBIDDEN_403,
        message
      })
    }

    return next()
  }
}

// ---------------------------------------------------------------------------

export {
  ensureUserHasRight
}
