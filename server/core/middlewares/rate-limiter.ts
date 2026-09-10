import { UserRole, UserRoleType } from '@peertube/peertube-models'
import { getAuthUser } from '@server/helpers/express-utils.js'
import { createLogger } from '@server/helpers/logger.js'
import { CONFIG } from '@server/initializers/config.js'
import { Redis } from '@server/lib/redis/index.js'
import { RunnerModel } from '@server/models/runner/runner.js'
import express from 'express'
import RateLimit, { ClientRateLimitInfo, ipKeyGenerator, Options as RateLimitHandlerOptions, Store } from 'express-rate-limit'
import RedisStore, { RedisReply } from 'rate-limit-redis'
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

  // Rate limit counters must be shared by every PeerTube process
  // But if it's unavailable, the caller must decide if we must fail the request or not
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
    store: buildRateLimitStore({ name: options.name, failOnUnavailableRedis: options.failOnUnavailableRedis === true }),

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

function buildRateLimitStore (storeOptions: {
  name: string
  failOnUnavailableRedis: boolean
}): Store {
  const { name, failOnUnavailableRedis } = storeOptions

  const store = new RedisStore({
    // According to the rate-limit-redis documentation for ioredis
    sendCommand: (command: string, ...args: string[]) => Redis.Instance.getClient().call(command, ...args) as Promise<RedisReply>,

    // The instance prefix is added by the dynamic buildKey() below
    prefix: ''
  })

  const buildKey = (key: string) => Redis.Instance.getPrefix() + 'rate-limit-' + name + '-' + key

  // Redis is initialized when express-rate-limit builds the middleware (at module load)
  // Lazy load the store on HTTP request
  let options: RateLimitHandlerOptions
  let storeInit: Promise<void>

  const ensureStoreInit = () => {
    if (storeInit === undefined) {
      storeInit = Promise.resolve(store.init(options))
        .catch(err => {
          storeInit = undefined

          throw err
        })
    }

    return storeInit
  }

  return {
    init: newOptions => {
      options = newOptions
    },

    async get (key: string): Promise<ClientRateLimitInfo> {
      try {
        await ensureStoreInit()

        return await store.get(buildKey(key))
      } catch (err) {
        logger.warn('Cannot read rate limit counter from Redis.', { err })

        return undefined
      }
    },

    async increment (key: string): Promise<ClientRateLimitInfo> {
      try {
        await ensureStoreInit()

        return await store.increment(buildKey(key))
      } catch (err) {
        if (failOnUnavailableRedis) {
          logger.error('Cannot increment rate limit counter in Redis, rejecting the request.', { err })

          // express-rate-limit compares it to the limit of the middleware, so the request is always rejected
          return { totalHits: Number.MAX_SAFE_INTEGER, resetTime: undefined }
        }

        logger.warn('Cannot increment rate limit counter in Redis, letting the request through.', { err })

        return { totalHits: 1, resetTime: undefined }
      }
    },

    async decrement (key: string) {
      try {
        await ensureStoreInit()

        await store.decrement(buildKey(key))
      } catch (err) {
        logger.warn('Cannot decrement rate limit counter in Redis.', { err })
      }
    },

    async resetKey (key: string) {
      try {
        await ensureStoreInit()

        await store.resetKey(buildKey(key))
      } catch (err) {
        logger.warn('Cannot reset rate limit counter in Redis.', { err })
      }
    }
  }
}
