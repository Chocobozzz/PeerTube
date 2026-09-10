import { MOAuthTokenUser } from '@server/types/models/index.js'
import { LRUCache } from 'lru-cache'
import { createLogger } from '../../helpers/logger.js'
import { LRU_CACHE } from '../../initializers/constants.js'
import { Redis, TokenInvalidationPayload } from '../redis/index.js'

const logger = createLogger()

export class TokensCache {
  private static instance: TokensCache

  private readonly accessTokenCache = new LRUCache<string, MOAuthTokenUser>({
    onInsert: (tokenModel, token) => {
      if (this.userHavingToken.has(tokenModel.userId)) {
        this.userHavingToken.get(tokenModel.userId).add(token)
      } else {
        this.userHavingToken.set(tokenModel.userId, new Set([ token ]))
      }
    },
    dispose: (tokenModel, token) => {
      if (this.userHavingToken.has(tokenModel.userId)) {
        const set = this.userHavingToken.get(tokenModel.userId)
        set.delete(token)

        if (set.size === 0) {
          this.userHavingToken.delete(tokenModel.userId)
        }
      }
    },
    max: LRU_CACHE.USER_TOKENS.MAX_SIZE,
    ttl: LRU_CACHE.USER_TOKENS.TTL
  })

  private readonly userHavingToken = new Map<number, Set<string>>()

  private constructor () {}

  static get Instance () {
    return this.instance || (this.instance = new this())
  }

  // If we have multiple processes, we need to listen to invalidation events from Redis to keep the cache in sync
  async listenForInvalidations () {
    await Redis.Instance.subscribeToTokenInvalidation(payload => {
      if (payload?.token) this.deleteTokenLocally(payload.token)
      else if (payload?.userId) this.deleteUserTokensLocally(payload.userId, payload.tokenException)
    })
  }

  hasToken (token: string) {
    return this.accessTokenCache.has(token)
  }

  getToken (token: string) {
    return this.accessTokenCache.get(token)
  }

  setToken (token: MOAuthTokenUser) {
    this.accessTokenCache.set(token.accessToken, token)
  }

  deleteToken (token: string) {
    this.deleteTokenLocally(token)

    this.broadcastInvalidation({ token })
  }

  deleteUserTokens (userId: number, tokenException?: string) {
    this.deleteUserTokensLocally(userId, tokenException)

    this.broadcastInvalidation({ userId, tokenException })
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private deleteTokenLocally (token: string) {
    this.accessTokenCache.delete(token)
  }

  private deleteUserTokensLocally (userId: number, tokenException?: string) {
    if (!this.userHavingToken.has(userId)) return

    const tokens = [ ...this.userHavingToken.get(userId) ]

    for (const token of tokens) {
      if (tokenException && token === tokenException) continue

      this.accessTokenCache.delete(token)
    }
  }

  private broadcastInvalidation (payload: TokenInvalidationPayload) {
    if (!Redis.Instance.isInitialized()) return

    Redis.Instance.publishTokenInvalidation(payload)
      .catch(err => logger.error('Cannot broadcast token invalidation.', { err }))
  }
}
