import express from 'express'
import { UserRight, UserRole } from '../../shared'
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

async function ensureUserCanManageChannel (req: express.Request, res: express.Response, next: express.NextFunction) {
  const user = res.locals.oauth.token.user
  const isUserOwner = res.locals.videoChannel.Account.userId !== user.id

  if (isUserOwner && user.hasRight(UserRight.MANAGE_ANY_VIDEO_CHANNEL) === false) {
    const message = `User ${user.username} does not have right to manage channel ${req.params.nameWithHost}.`
    logger.info(message)

    return res.fail({
      status: HttpStatusCode.FORBIDDEN_403,
      message
    })
  }

  const onUser = await res.locals.videoChannel.Account.$get('User')
  if (user.role === UserRole.MODERATOR && onUser.role === UserRole.ADMINISTRATOR) {
    return res.fail({
      status: HttpStatusCode.FORBIDDEN_403,
      message: 'A moderator can\'t manage an admins video channel.'
    })
  }

  return next()
}

// ---------------------------------------------------------------------------

export {
  ensureUserHasRight,
  ensureUserCanManageChannel
}
