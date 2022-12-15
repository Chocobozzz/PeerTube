import { UserTokenLocalStorageKeys } from './user-local-storage-keys'

export class OAuthUserTokens {
  accessToken: string
  refreshToken: string
  tokenType: string

  constructor (hash?: Partial<OAuthUserTokens>) {
    if (hash) {
      this.accessToken = hash.accessToken
      this.refreshToken = hash.refreshToken

      if (hash.tokenType === 'bearer') {
        this.tokenType = 'Bearer'
      } else {
        this.tokenType = hash.tokenType
      }
    }
  }

  static getUserTokens (localStorage: Pick<Storage, 'getItem'>) {
    const accessTokenLocalStorage = localStorage.getItem(UserTokenLocalStorageKeys.ACCESS_TOKEN)
    const refreshTokenLocalStorage = localStorage.getItem(UserTokenLocalStorageKeys.REFRESH_TOKEN)
    const tokenTypeLocalStorage = localStorage.getItem(UserTokenLocalStorageKeys.TOKEN_TYPE)

    if (!accessTokenLocalStorage || !refreshTokenLocalStorage || !tokenTypeLocalStorage) return null

    return new OAuthUserTokens({
      accessToken: accessTokenLocalStorage,
      refreshToken: refreshTokenLocalStorage,
      tokenType: tokenTypeLocalStorage
    })
  }

  static saveToLocalStorage (localStorage: Pick<Storage, 'setItem'>, tokens: OAuthUserTokens) {
    localStorage.setItem(UserTokenLocalStorageKeys.ACCESS_TOKEN, tokens.accessToken)
    localStorage.setItem(UserTokenLocalStorageKeys.REFRESH_TOKEN, tokens.refreshToken)
    localStorage.setItem(UserTokenLocalStorageKeys.TOKEN_TYPE, tokens.tokenType)
  }

  static flushLocalStorage (localStorage: Pick<Storage, 'removeItem'>) {
    localStorage.removeItem(UserTokenLocalStorageKeys.ACCESS_TOKEN)
    localStorage.removeItem(UserTokenLocalStorageKeys.REFRESH_TOKEN)
    localStorage.removeItem(UserTokenLocalStorageKeys.TOKEN_TYPE)
  }
}
