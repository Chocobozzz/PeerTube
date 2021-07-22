import { HttpStatusCode } from '../../../shared/models/http/http-error-codes'
import { Redis } from '../../lib/redis'
import { ApiCache, APICacheOptions } from './shared'

// Ensure Redis is initialized
Redis.Instance.init()

const defaultOptions: APICacheOptions = {
  excludeStatus: [
    HttpStatusCode.FORBIDDEN_403,
    HttpStatusCode.NOT_FOUND_404
  ]
}

function cacheRoute (duration: string) {
  const instance = new ApiCache(defaultOptions)

  return instance.buildMiddleware(duration)
}

function cacheRouteFactory (options: APICacheOptions) {
  const instance = new ApiCache({ ...defaultOptions, ...options })

  return instance.buildMiddleware.bind(instance)
}

// ---------------------------------------------------------------------------

export {
  cacheRoute,
  cacheRouteFactory
}
