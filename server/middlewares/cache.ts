import { Redis } from '../lib/redis'
import * as apicache from 'apicache-plus'

// Ensure Redis is initialized
Redis.Instance.init()

const defaultOptions = {
  redisClient: Redis.Instance.getClient(),
  append: () => Redis.Instance.getPrefix(),
  statusCodes: {
    exclude: [ 404, 403 ]
  },
  headers: {
    'cache-control': 'no-transform' // disable compression of cache contents
  }
}

const cacheRoute = (extraOptions = {}) => apicache.options({
  ...defaultOptions,
  ...extraOptions
})

// ---------------------------------------------------------------------------

export {
  cacheRoute
}
