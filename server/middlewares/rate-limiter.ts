import express from 'express'
import RateLimit, { Options as RateLimitHandlerOptions } from 'express-rate-limit'
import { RunnerModel } from '@server/models/runner/runner'
import { UserRole } from '@shared/models'
import { optionalAuthenticate } from './auth'

const whitelistRoles = new Set([ UserRole.ADMINISTRATOR, UserRole.MODERATOR ])

export function buildRateLimiter (options: {
  windowMs: number
  max: number
  skipFailedRequests?: boolean
}) {
  return RateLimit({
    windowMs: options.windowMs,
    max: options.max,
    skipFailedRequests: options.skipFailedRequests,

    handler: (req, res, next, options) => {
      // Bypass rate limit for registered runners
      if (req.body?.runnerToken) {
        return RunnerModel.loadByToken(req.body.runnerToken)
          .then(runner => {
            if (runner) return next()

            return sendRateLimited(res, options)
          })
      }

      // Bypass rate limit for admins/moderators
      return optionalAuthenticate(req, res, () => {
        if (res.locals.authenticated === true && whitelistRoles.has(res.locals.oauth.token.User.role)) {
          return next()
        }

        return sendRateLimited(res, options)
      })
    }
  })
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

function sendRateLimited (res: express.Response, options: RateLimitHandlerOptions) {
  return res.status(options.statusCode).send(options.message)

}
