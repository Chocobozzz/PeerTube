// pure version of auth-user, that doesn't import app packages
import { peertubeLocalStorage } from '@root-helpers/peertube-web-storage'
import {
  MyUser as ServerMyUserModel,
  MyUserSpecialPlaylist,
  NSFWPolicyType,
  UserRole
} from '@shared/models'
import { UserKeys } from '@root-helpers/user-keys'

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

export class PureAuthUser {
  tokens: Tokens
  specialPlaylists: MyUserSpecialPlaylist[]

  canSeeVideosLink = true

  static load () {
    const usernameLocalStorage = peertubeLocalStorage.getItem(UserKeys.USERNAME)
    if (usernameLocalStorage) {
      return new PureAuthUser(
        {
          id: parseInt(peertubeLocalStorage.getItem(UserKeys.ID), 10),
          username: peertubeLocalStorage.getItem(UserKeys.USERNAME),
          email: peertubeLocalStorage.getItem(UserKeys.EMAIL),
          role: parseInt(peertubeLocalStorage.getItem(UserKeys.ROLE), 10) as UserRole,
          nsfwPolicy: peertubeLocalStorage.getItem(UserKeys.NSFW_POLICY) as NSFWPolicyType,
          webTorrentEnabled: peertubeLocalStorage.getItem(UserKeys.WEBTORRENT_ENABLED) === 'true',
          autoPlayVideo: peertubeLocalStorage.getItem(UserKeys.AUTO_PLAY_VIDEO) === 'true',
          videosHistoryEnabled: peertubeLocalStorage.getItem(UserKeys.VIDEOS_HISTORY_ENABLED) === 'true'
        },
        Tokens.load()
      )
    }

    return null
  }

  constructor (userHash: Partial<ServerMyUserModel>, hashTokens: TokenOptions) {
    this.tokens = new Tokens(hashTokens)
    this.specialPlaylists = userHash.specialPlaylists
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
    this.tokens.save()
  }
}
