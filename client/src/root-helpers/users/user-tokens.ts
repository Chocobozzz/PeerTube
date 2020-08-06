import { peertubeLocalStorage } from '../peertube-web-storage'

export type TokenOptions = {
  accessToken: string
  refreshToken: string
  tokenType: string
}

// Private class only used by User
export class Tokens {
  private static KEYS = {
    ACCESS_TOKEN: 'access_token',
    REFRESH_TOKEN: 'refresh_token',
    TOKEN_TYPE: 'token_type'
  }

  accessToken: string
  refreshToken: string
  tokenType: string

  static load () {
    const accessTokenLocalStorage = peertubeLocalStorage.getItem(this.KEYS.ACCESS_TOKEN)
    const refreshTokenLocalStorage = peertubeLocalStorage.getItem(this.KEYS.REFRESH_TOKEN)
    const tokenTypeLocalStorage = peertubeLocalStorage.getItem(this.KEYS.TOKEN_TYPE)

    if (accessTokenLocalStorage && refreshTokenLocalStorage && tokenTypeLocalStorage) {
      return new Tokens({
        accessToken: accessTokenLocalStorage,
        refreshToken: refreshTokenLocalStorage,
        tokenType: tokenTypeLocalStorage
      })
    }

    return null
  }

  static flush () {
    peertubeLocalStorage.removeItem(this.KEYS.ACCESS_TOKEN)
    peertubeLocalStorage.removeItem(this.KEYS.REFRESH_TOKEN)
    peertubeLocalStorage.removeItem(this.KEYS.TOKEN_TYPE)
  }

  constructor (hash?: TokenOptions) {
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

  save () {
    peertubeLocalStorage.setItem(Tokens.KEYS.ACCESS_TOKEN, this.accessToken)
    peertubeLocalStorage.setItem(Tokens.KEYS.REFRESH_TOKEN, this.refreshToken)
    peertubeLocalStorage.setItem(Tokens.KEYS.TOKEN_TYPE, this.tokenType)
  }
}
