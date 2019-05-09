import { Redis } from '../lib/redis'
import * as apicache from 'apicache'

// Ensure Redis is initialized
Redis.Instance.init()

const options = {
  redisClient: Redis.Instance.getClient(),
  appendKey: () => Redis.Instance.getPrefix()
}

const cacheRoute = apicache.options(options).middleware

// ---------------------------------------------------------------------------

export {
  cacheRoute
}
