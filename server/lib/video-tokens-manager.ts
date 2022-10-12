import LRUCache from 'lru-cache'
import { LRU_CACHE } from '@server/initializers/constants'
import { buildUUID } from '@shared/extra-utils'

// ---------------------------------------------------------------------------
// Create temporary tokens that can be used as URL query parameters to access video static files
// ---------------------------------------------------------------------------

class VideoTokensManager {

  private static instance: VideoTokensManager

  private readonly lruCache = new LRUCache<string, string>({
    max: LRU_CACHE.VIDEO_TOKENS.MAX_SIZE,
    ttl: LRU_CACHE.VIDEO_TOKENS.TTL
  })

  private constructor () {}

  create (videoUUID: string) {
    const token = buildUUID()

    const expires = new Date(new Date().getTime() + LRU_CACHE.VIDEO_TOKENS.TTL)

    this.lruCache.set(token, videoUUID)

    return { token, expires }
  }

  hasToken (options: {
    token: string
    videoUUID: string
  }) {
    const value = this.lruCache.get(options.token)
    if (!value) return false

    return value === options.videoUUID
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}

// ---------------------------------------------------------------------------

export {
  VideoTokensManager
}
