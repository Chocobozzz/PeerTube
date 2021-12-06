import express from 'express'
import { UserRight } from '../../shared'
import { HttpStatusCode } from '../../shared/models/http/http-error-codes'
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

function ensureUserCanManageChannel (req: express.Request, res: express.Response, next: express.NextFunction) {
  const user = res.locals.oauth.token.user
  const isUserOwner = res.locals.videoChannel.Account.userId !== user.id

  if (isUserOwner && user.hasRight(UserRight.MANAGE_VIDEO_CHANNELS) === false) {
    const message = `User ${user.username} does not have right to manage channel ${req.params.nameWithHost}.`
    logger.info(message)

    return res.fail({
      status: HttpStatusCode.FORBIDDEN_403,
      message
    })
  }

  return next()
}

// ---------------------------------------------------------------------------

export {
  ensureUserHasRight,
  ensureUserCanManageChannel
}
