import LRUCache from 'lru-cache'
import { MOAuthTokenUser } from '@server/types/models'
import { LRU_CACHE } from '../../initializers/constants'

export class TokensCache {

  private static instance: TokensCache

  private readonly accessTokenCache = new LRUCache<string, MOAuthTokenUser>({ max: LRU_CACHE.USER_TOKENS.MAX_SIZE })
  private readonly userHavingToken = new LRUCache<number, string>({ max: LRU_CACHE.USER_TOKENS.MAX_SIZE })

  private constructor () { }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }

  hasToken (token: string) {
    return this.accessTokenCache.has(token)
  }

  getByToken (token: string) {
    return this.accessTokenCache.get(token)
  }

  setToken (token: MOAuthTokenUser) {
    this.accessTokenCache.set(token.accessToken, token)
    this.userHavingToken.set(token.userId, token.accessToken)
  }

  deleteUserToken (userId: number) {
    this.clearCacheByUserId(userId)
  }

  clearCacheByUserId (userId: number) {
    const token = this.userHavingToken.get(userId)

    if (token !== undefined) {
      this.accessTokenCache.del(token)
      this.userHavingToken.del(userId)
    }
  }

  clearCacheByToken (token: string) {
    const tokenModel = this.accessTokenCache.get(token)

    if (tokenModel !== undefined) {
      this.userHavingToken.del(tokenModel.userId)
      this.accessTokenCache.del(token)
    }
  }
}
