import { UserRole, UserRoleType } from '@peertube/peertube-models'
import { getAuthUser } from '@server/helpers/express-utils.js'
import { createLogger } from '@server/helpers/logger.js'
import { CONFIG } from '@server/initializers/config.js'
import { SharedRateLimitStore } from '@server/lib/redis/rate-limit-store.js'
import { RunnerModel } from '@server/models/runner/runner.js'
import express from 'express'
import RateLimit, { ipKeyGenerator, Options as RateLimitHandlerOptions } from 'express-rate-limit'
import { optionalAuthenticate } from './auth.js'

const logger = createLogger('rate-limit')

const whitelistRoles = new Set<UserRoleType>([ UserRole.ADMINISTRATOR, UserRole.MODERATOR ])

export function buildRateLimiter (options: {
  enabled?: boolean // Default: true

  // Used to namespace the counters in Redis, must be unique per limiter
  name: string

  windowMs: number
  max: number
  skipFailedRequests?: boolean

  // Key the counter on the authenticated user instead of the source IP
  perUserKey?: boolean

  // Rate limit counters are shared by every PeerTube process using Redis
  // If true, wait for Redis to count the hit and reject the request if it is unavailable
  // If false, count hits locally and sync them with Redis in the background: other processes may slightly exceed the limit
  // default: false
  failOnUnavailableRedis?: boolean
}) {
  if (options.enabled === false) {
    return (req: express.Request, res: express.Response, next: express.NextFunction) => next()
  }

  return RateLimit({
    windowMs: options.windowMs,
    limit: options.max,
    skipFailedRequests: options.skipFailedRequests,
    store: new SharedRateLimitStore({ name: options.name, strict: options.failOnUnavailableRedis === true }),

    keyGenerator: options.perUserKey === true
      ? (req: express.Request, res: express.Response) => {
        const user = getAuthUser(res)

        return user
          ? 'user-' + user.id
          : ipKeyGenerator(req.ip)
      }
      : undefined,

    handler: (req, res, next, options) => {
      // Bypass rate limit for registered runners
      if (req.body?.runnerToken) {
        return RunnerModel.loadByToken(req.body.runnerToken)
          .then(runner => {
            if (runner) return next()

            return sendRateLimited(req, res, options)
          })
      }

      // Bypass rate limit for admins/moderators
      return optionalAuthenticate(req, res, () => {
        if (res.locals.authenticated === true && whitelistRoles.has(res.locals.oauth.token.User.role)) {
          return next()
        }

        return sendRateLimited(req, res, options)
      })
    }
  })
}

export const apiRateLimiter = buildRateLimiter({
  enabled: CONFIG.RATES_LIMIT.API.ENABLED,
  name: 'api',
  windowMs: CONFIG.RATES_LIMIT.API.WINDOW_MS,
  max: CONFIG.RATES_LIMIT.API.MAX
})

// Endpoints that consume a token sent by email or generated for the user (reset password, verify email, confirm 2FA)
export const confirmTokenRateLimiter = buildRateLimiter({
  enabled: CONFIG.RATES_LIMIT.CONFIRM_TOKEN.ENABLED,
  name: 'confirm-token',
  windowMs: CONFIG.RATES_LIMIT.CONFIRM_TOKEN.WINDOW_MS,
  max: CONFIG.RATES_LIMIT.CONFIRM_TOKEN.MAX,
  failOnUnavailableRedis: true
})

export const activityPubRateLimiter = buildRateLimiter({
  enabled: CONFIG.RATES_LIMIT.ACTIVITY_PUB.ENABLED,
  name: 'activity-pub',
  windowMs: CONFIG.RATES_LIMIT.ACTIVITY_PUB.WINDOW_MS,
  max: CONFIG.RATES_LIMIT.ACTIVITY_PUB.MAX
})

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

function sendRateLimited (req: express.Request, res: express.Response, options: RateLimitHandlerOptions) {
  logger.debug('Rate limit exceeded for route ' + req.originalUrl, { route: req.originalUrl, ip: req.ip })

  return res.status(options.statusCode).send(options.message)
}
