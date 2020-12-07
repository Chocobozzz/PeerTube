import { Redis } from '../lib/redis'
import * as apicache from 'apicache'
import { HttpStatusCode } from '../../shared/core-utils/miscs/http-error-codes'

// Ensure Redis is initialized
Redis.Instance.init()

const defaultOptions = {
  redisClient: Redis.Instance.getClient(),
  appendKey: () => Redis.Instance.getPrefix(),
  statusCodes: {
    exclude: [
      HttpStatusCode.FORBIDDEN_403,
      HttpStatusCode.NOT_FOUND_404
    ]
  }
}

const cacheRoute = (extraOptions = {}) => apicache.options({
  ...defaultOptions,
  ...extraOptions
}).middleware

// ---------------------------------------------------------------------------

export {
  cacheRoute
}
