import { HttpStatusCode } from '@peertube/peertube-models'
import { ApiCache, APICacheOptions } from './shared/index.js'

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

  return { instance, middleware: instance.buildMiddleware.bind(instance) }
}

// ---------------------------------------------------------------------------

function buildPodcastGroupsCache (options: {
  channelId: number
}) {
  return 'podcast-feed-' + options.channelId
}

// ---------------------------------------------------------------------------

export {
  cacheRoute,
  cacheRouteFactory,

  buildPodcastGroupsCache
}
