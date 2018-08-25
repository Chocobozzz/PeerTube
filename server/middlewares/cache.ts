import * as express from 'express'
import * as AsyncLock from 'async-lock'
import { parseDuration } from '../helpers/core-utils'
import { Redis } from '../lib/redis'
import { logger } from '../helpers/logger'

const lock = new AsyncLock({ timeout: 5000 })

function cacheRoute (lifetimeArg: string | number) {
  return async function (req: express.Request, res: express.Response, next: express.NextFunction) {
    const redisKey = Redis.Instance.buildCachedRouteKey(req)

    try {
      await lock.acquire(redisKey, async (done) => {
        const cached = await Redis.Instance.getCachedRoute(req)

        // Not cached
        if (!cached) {
          logger.debug('No cached results for route %s.', req.originalUrl)

          const sendSave = res.send.bind(res)

          res.send = (body) => {
            if (res.statusCode >= 200 && res.statusCode < 400) {
              const contentType = res.get('content-type')
              const lifetime = parseDuration(lifetimeArg)

              Redis.Instance.setCachedRoute(req, body, lifetime, contentType, res.statusCode)
                   .then(() => done())
                   .catch(err => {
                     logger.error('Cannot cache route.', { err })
                     return done(err)
                   })
            }

            return sendSave(body)
          }

          return next()
        }

        if (cached.contentType) res.set('content-type', cached.contentType)

        if (cached.statusCode) {
          const statusCode = parseInt(cached.statusCode, 10)
          if (!isNaN(statusCode)) res.status(statusCode)
        }

        logger.debug('Use cached result for %s.', req.originalUrl)
        res.send(cached.body).end()

        return done()
      })
    } catch (err) {
      logger.error('Cannot serve cached route.', err)
      return next()
    }
  }
}

// ---------------------------------------------------------------------------

export {
  cacheRoute
}
