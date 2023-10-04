import { LRUCache } from 'lru-cache'
import { LRU_CACHE } from '@server/initializers/constants.js'
import { MUserAccountUrl } from '@server/types/models/index.js'
import { pick } from '@peertube/peertube-core-utils'
import { buildUUID } from '@peertube/peertube-node-utils'

// ---------------------------------------------------------------------------
// Create temporary tokens that can be used as URL query parameters to access video static files
// ---------------------------------------------------------------------------

class VideoTokensManager {

  private static instance: VideoTokensManager

  private readonly lruCache = new LRUCache<string, { videoUUID: string, user?: MUserAccountUrl }>({
    max: LRU_CACHE.VIDEO_TOKENS.MAX_SIZE,
    ttl: LRU_CACHE.VIDEO_TOKENS.TTL
  })

  private constructor () {}

  createForAuthUser (options: {
    user: MUserAccountUrl
    videoUUID: string
  }) {
    const { token, expires } = this.generateVideoToken()

    this.lruCache.set(token, pick(options, [ 'user', 'videoUUID' ]))

    return { token, expires }
  }

  createForPasswordProtectedVideo (options: {
    videoUUID: string
  }) {
    const { token, expires } = this.generateVideoToken()

    this.lruCache.set(token, pick(options, [ 'videoUUID' ]))

    return { token, expires }
  }

  hasToken (options: {
    token: string
    videoUUID: string
  }) {
    const value = this.lruCache.get(options.token)
    if (!value) return false

    return value.videoUUID === options.videoUUID
  }

  getUserFromToken (options: {
    token: string
  }) {
    const value = this.lruCache.get(options.token)
    if (!value) return undefined

    return value.user
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }

  private generateVideoToken () {
    const token = buildUUID()
    const expires = new Date(new Date().getTime() + LRU_CACHE.VIDEO_TOKENS.TTL)

    return { token, expires }
  }
}

// ---------------------------------------------------------------------------

export {
  VideoTokensManager
}
