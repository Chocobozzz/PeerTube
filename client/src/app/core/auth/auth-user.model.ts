// Do not use the barrel (dependency loop)
import { UserRole } from '../../../../../shared/models/users/user-role.type'
import { User, UserConstructorHash } from '../../shared/users/user.model'

export type TokenOptions = {
  accessToken: string
  refreshToken: string
  tokenType: string
}

// Private class only used by User
class Tokens {
  private static KEYS = {
    ACCESS_TOKEN: 'access_token',
    REFRESH_TOKEN: 'refresh_token',
    TOKEN_TYPE: 'token_type'
  }

  accessToken: string
  refreshToken: string
  tokenType: string

  static load () {
    const accessTokenLocalStorage = localStorage.getItem(this.KEYS.ACCESS_TOKEN)
    const refreshTokenLocalStorage = localStorage.getItem(this.KEYS.REFRESH_TOKEN)
    const tokenTypeLocalStorage = localStorage.getItem(this.KEYS.TOKEN_TYPE)

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
    localStorage.removeItem(this.KEYS.ACCESS_TOKEN)
    localStorage.removeItem(this.KEYS.REFRESH_TOKEN)
    localStorage.removeItem(this.KEYS.TOKEN_TYPE)
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
    localStorage.setItem(Tokens.KEYS.ACCESS_TOKEN, this.accessToken)
    localStorage.setItem(Tokens.KEYS.REFRESH_TOKEN, this.refreshToken)
    localStorage.setItem(Tokens.KEYS.TOKEN_TYPE, this.tokenType)
  }
}

export class AuthUser extends User {
  private static KEYS = {
    ID: 'id',
    ROLE: 'role',
    EMAIL: 'email',
    USERNAME: 'username',
    DISPLAY_NSFW: 'display_nsfw'
  }

  tokens: Tokens

  static load () {
    const usernameLocalStorage = localStorage.getItem(this.KEYS.USERNAME)
    if (usernameLocalStorage) {
      return new AuthUser(
        {
          id: parseInt(localStorage.getItem(this.KEYS.ID), 10),
          username: localStorage.getItem(this.KEYS.USERNAME),
          email: localStorage.getItem(this.KEYS.EMAIL),
          role: localStorage.getItem(this.KEYS.ROLE) as UserRole,
          displayNSFW: localStorage.getItem(this.KEYS.DISPLAY_NSFW) === 'true'
        },
        Tokens.load()
      )
    }

    return null
  }

  static flush () {
    localStorage.removeItem(this.KEYS.USERNAME)
    localStorage.removeItem(this.KEYS.ID)
    localStorage.removeItem(this.KEYS.ROLE)
    localStorage.removeItem(this.KEYS.DISPLAY_NSFW)
    localStorage.removeItem(this.KEYS.EMAIL)
    Tokens.flush()
  }

  constructor (userHash: UserConstructorHash, hashTokens: TokenOptions) {
    super(userHash)
    this.tokens = new Tokens(hashTokens)
  }

  getAccessToken () {
    return this.tokens.accessToken
  }

  getRefreshToken () {
    return this.tokens.refreshToken
  }

  getTokenType () {
    return this.tokens.tokenType
  }

  refreshTokens (accessToken: string, refreshToken: string) {
    this.tokens.accessToken = accessToken
    this.tokens.refreshToken = refreshToken
  }

  save () {
    localStorage.setItem(AuthUser.KEYS.ID, this.id.toString())
    localStorage.setItem(AuthUser.KEYS.USERNAME, this.username)
    localStorage.setItem(AuthUser.KEYS.EMAIL, this.email)
    localStorage.setItem(AuthUser.KEYS.ROLE, this.role)
    localStorage.setItem(AuthUser.KEYS.DISPLAY_NSFW, JSON.stringify(this.displayNSFW))
    this.tokens.save()
  }
}
