import { peertubeLocalStorage } from '@app/shared/misc/peertube-web-storage'
import { UserRight } from '../../../../../shared/models/users/user-right.enum'
import { MyUser as ServerMyUserModel, User as ServerUserModel, MyUserSpecialPlaylist } from '../../../../../shared/models/users/user.model'
// Do not use the barrel (dependency loop)
import { hasUserRight, UserRole } from '../../../../../shared/models/users/user-role'
import { User } from '../../shared/users/user.model'
import { NSFWPolicyType } from '../../../../../shared/models/videos/nsfw-policy.type'

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

export class AuthUser extends User implements ServerMyUserModel {
  tokens: Tokens
  specialPlaylists: MyUserSpecialPlaylist[]

  static load () {
    const usernameLocalStorage = peertubeLocalStorage.getItem(this.KEYS.USERNAME)
    if (usernameLocalStorage) {
      return new AuthUser(
        {
          id: parseInt(peertubeLocalStorage.getItem(this.KEYS.ID), 10),
          username: peertubeLocalStorage.getItem(this.KEYS.USERNAME),
          email: peertubeLocalStorage.getItem(this.KEYS.EMAIL),
          role: parseInt(peertubeLocalStorage.getItem(this.KEYS.ROLE), 10) as UserRole,
          nsfwPolicy: peertubeLocalStorage.getItem(this.KEYS.NSFW_POLICY) as NSFWPolicyType,
          webTorrentEnabled: peertubeLocalStorage.getItem(this.KEYS.WEBTORRENT_ENABLED) === 'true',
          autoPlayVideo: peertubeLocalStorage.getItem(this.KEYS.AUTO_PLAY_VIDEO) === 'true',
          videosHistoryEnabled: peertubeLocalStorage.getItem(this.KEYS.VIDEOS_HISTORY_ENABLED) === 'true'
        },
        Tokens.load()
      )
    }

    return null
  }

  static flush () {
    peertubeLocalStorage.removeItem(this.KEYS.USERNAME)
    peertubeLocalStorage.removeItem(this.KEYS.ID)
    peertubeLocalStorage.removeItem(this.KEYS.ROLE)
    peertubeLocalStorage.removeItem(this.KEYS.EMAIL)
    Tokens.flush()
  }

  constructor (userHash: Partial<ServerMyUserModel>, hashTokens: TokenOptions) {
    super(userHash)

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

  hasRight (right: UserRight) {
    return hasUserRight(this.role, right)
  }

  canManage (user: ServerUserModel) {
    const myRole = this.role

    if (myRole === UserRole.ADMINISTRATOR) return true

    // I'm a moderator: I can only manage users
    return user.role === UserRole.USER
  }

  save () {
    peertubeLocalStorage.setItem(AuthUser.KEYS.ID, this.id.toString())
    peertubeLocalStorage.setItem(AuthUser.KEYS.USERNAME, this.username)
    peertubeLocalStorage.setItem(AuthUser.KEYS.EMAIL, this.email)
    peertubeLocalStorage.setItem(AuthUser.KEYS.ROLE, this.role.toString())
    peertubeLocalStorage.setItem(AuthUser.KEYS.NSFW_POLICY, this.nsfwPolicy.toString())
    peertubeLocalStorage.setItem(AuthUser.KEYS.WEBTORRENT_ENABLED, JSON.stringify(this.webTorrentEnabled))
    peertubeLocalStorage.setItem(AuthUser.KEYS.AUTO_PLAY_VIDEO, JSON.stringify(this.autoPlayVideo))
    this.tokens.save()
  }
}
