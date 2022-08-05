import { UserRole } from '@shared/models'
import RateLimit from 'express-rate-limit'
import { optionalAuthenticate } from './auth'

const whitelistRoles = new Set([ UserRole.ADMINISTRATOR, UserRole.MODERATOR ])

function buildRateLimiter (options: {
  windowMs: number
  max: number
  skipFailedRequests?: boolean
}) {
  return RateLimit({
    windowMs: options.windowMs,
    max: options.max,
    skipFailedRequests: options.skipFailedRequests,

    handler: (req, res, next, options) => {
      return optionalAuthenticate(req, res, () => {
        if (res.locals.authenticated === true && whitelistRoles.has(res.locals.oauth.token.User.role)) {
          return next()
        }

        return res.status(options.statusCode).send(options.message)
      })
    }
  })
}

export {
  buildRateLimiter
}
