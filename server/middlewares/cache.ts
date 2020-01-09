import { Redis } from '../lib/redis'
import * as apicache from 'apicache'

// Ensure Redis is initialized
Redis.Instance.init()

const defaultOptions = {
  redisClient: Redis.Instance.getClient(),
  appendKey: () => Redis.Instance.getPrefix(),
  statusCodes: {
    exclude: [ 404, 403 ]
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
