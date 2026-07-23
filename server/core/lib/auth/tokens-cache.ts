import { LRUCache } from 'lru-cache'
import { MOAuthTokenUser } from '@server/types/models/index.js'
import { LRU_CACHE } from '../../initializers/constants.js'

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
    max: LRU_CACHE.USER_TOKENS.MAX_SIZE
  })

  private readonly userHavingToken = new Map<number, Set<string>>()

  private constructor () {}

  static get Instance () {
    return this.instance || (this.instance = new this())
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
    this.accessTokenCache.delete(token)
  }

  deleteUserTokens (userId: number, tokenException?: string) {
    if (!this.userHavingToken.has(userId)) return

    const tokens = [ ...this.userHavingToken.get(userId) ]

    for (const token of tokens) {
      if (tokenException && token === tokenException) continue

      this.accessTokenCache.delete(token)
    }
  }
}
