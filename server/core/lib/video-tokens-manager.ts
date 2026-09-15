import { buildUUID } from '@peertube/peertube-node-utils'
import { createLogger } from '@server/helpers/logger.js'
import { LRU_CACHE, VIDEO_FILE_TOKEN_LIFETIME } from '@server/initializers/constants.js'
import { getVideoTokenTTL, Redis } from '@server/lib/redis/index.js'
import { UserModel } from '@server/models/user/user.js'
import { MUserAccountUrl } from '@server/types/models/index.js'
import { LRUCache } from 'lru-cache'
import { TokensCache } from './auth/tokens-cache.js'

const logger = createLogger()

type ResolvedToken = {
  videoUUID: string
  user?: MUserAccountUrl
}

// ---------------------------------------------------------------------------
// Create temporary tokens that can be used as URL query parameters to access video static files
// ---------------------------------------------------------------------------

class VideoTokensManager {
  private static instance: VideoTokensManager

  // A player requests many files with the same token, so resolve it once per process
  // The payload of a token never changes: an entry lives as long as its token, unless its user is updated or deleted
  private readonly resolvedTokens = new LRUCache<string, ResolvedToken>({
    max: LRU_CACHE.VIDEO_TOKENS.MAX_SIZE,
    ttl: VIDEO_FILE_TOKEN_LIFETIME,
    onInsert: (resolved, token) => {
      if (!resolved.user) return

      const userId = resolved.user.id

      if (this.tokensOfUser.has(userId)) {
        this.tokensOfUser.get(userId).add(token)
      } else {
        this.tokensOfUser.set(userId, new Set([ token ]))
      }
    },
    dispose: (resolved, token) => {
      if (!resolved.user) return

      const userId = resolved.user.id
      const tokens = this.tokensOfUser.get(userId)
      if (!tokens) return

      tokens.delete(token)
      if (tokens.size === 0) this.tokensOfUser.delete(userId)
    }
  })

  private readonly tokensOfUser = new Map<number, Set<string>>()

  // Concurrent requests using a token that is not resolved yet share the same Redis and database queries
  private readonly pendingResolutions = new Map<string, Promise<ResolvedToken>>()

  // Prevent concurrency issues on user invalidation
  // Global on purpose: any user invalidation during a load prevents caching its result (safe and rare)
  private userInvalidations = 0

  private constructor () {
    TokensCache.Instance.registerUserTokensDeletedHandler(userId => this.deleteUserTokensLocally(userId))
  }

  async create (options: {
    user: MUserAccountUrl
    videoUUID: string
  }) {
    const { user, videoUUID } = options
    const { token, expires } = this.generateVideoToken()

    // The user may be invalidated while we write the token, prevent caching it if that happens
    const invalidationsBefore = this.userInvalidations

    await Redis.Instance.setVideoToken(token, { videoUUID, userId: user?.id, expires: expires.getTime() })

    const ttl = getVideoTokenTTL(expires.getTime())
    if (ttl > 0 && invalidationsBefore === this.userInvalidations) {
      this.resolvedTokens.set(token, { videoUUID, user }, { ttl })
    }

    return { token, expires }
  }

  // Check the token exists for this video and resolve the user that generated it
  async resolveToken (options: {
    token: string
    videoUUID: string
  }): Promise<{ valid: boolean, user?: MUserAccountUrl }> {
    const resolved = this.resolvedTokens.get(options.token) ?? await this.loadTokenFromRedis(options.token)

    if (!resolved || resolved.videoUUID !== options.videoUUID) return { valid: false }

    return { valid: true, user: resolved.user }
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private loadTokenFromRedis (token: string) {
    const pending = this.pendingResolutions.get(token)
    if (pending !== undefined) return pending

    const loading = this.loadToken(token)
      .finally(() => this.pendingResolutions.delete(token))

    this.pendingResolutions.set(token, loading)

    return loading
  }

  private async loadToken (token: string): Promise<ResolvedToken> {
    // Ensure we don't reload a token while a user is invalidated
    const invalidationsBefore = this.userInvalidations

    const payload = await Redis.Instance.getVideoToken(token)
    if (!payload) return undefined

    const ttl = getVideoTokenTTL(payload.expires)
    if (ttl <= 0) return undefined

    let user: MUserAccountUrl

    if (payload.userId) {
      // The user may have been deleted since the token was generated
      user = await UserModel.loadByIdWithAccountUrl(payload.userId)

      if (!user) {
        logger.debug('Video file token of user %d that does not exist anymore.', payload.userId)

        return undefined
      }
    }

    const resolved: ResolvedToken = { videoUUID: payload.videoUUID, user }

    if (invalidationsBefore === this.userInvalidations) {
      this.resolvedTokens.set(token, resolved, { ttl })
    }

    return resolved
  }

  private deleteUserTokensLocally (userId: number) {
    this.userInvalidations++

    const tokens = this.tokensOfUser.get(userId)
    if (!tokens) return

    for (const token of [ ...tokens ]) {
      this.resolvedTokens.delete(token)
    }
  }

  private generateVideoToken () {
    const token = buildUUID()
    const expires = new Date(new Date().getTime() + VIDEO_FILE_TOKEN_LIFETIME)

    return { token, expires }
  }
}

// ---------------------------------------------------------------------------

export {
  VideoTokensManager
}
