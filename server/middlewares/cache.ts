import * as express from 'express'
import { Redis } from '../lib/redis'
import { logger } from '../helpers/logger'

function cacheRoute (lifetime: number) {
  return async function (req: express.Request, res: express.Response, next: express.NextFunction) {
    const cached = await Redis.Instance.getCachedRoute(req)

    // Not cached
    if (!cached) {
      logger.debug('Not cached result for route %s.', req.originalUrl)

      const sendSave = res.send.bind(res)

      res.send = (body) => {
        if (res.statusCode >= 200 && res.statusCode < 400) {
          const contentType = res.getHeader('content-type').toString()
          Redis.Instance.setCachedRoute(req, body, lifetime, contentType, res.statusCode)
               .catch(err => logger.error('Cannot cache route.', { err }))
        }

        return sendSave(body)
      }

      return next()
    }

    if (cached.contentType) res.contentType(cached.contentType)

    if (cached.statusCode) {
      const statusCode = parseInt(cached.statusCode, 10)
      if (!isNaN(statusCode)) res.status(statusCode)
    }

    logger.debug('Use cached result for %s.', req.originalUrl)
    return res.send(cached.body).end()
  }
}

// ---------------------------------------------------------------------------

export {
  cacheRoute
}
