import { Observable, of } from 'rxjs'
import { map } from 'rxjs/operators'
import { User } from '@app/core/users/user.model'
import { peertubeLocalStorage } from '@root-helpers/peertube-web-storage'
import { hasUserRight } from '@shared/core-utils/users'
import {
  MyUser as ServerMyUserModel,
  MyUserSpecialPlaylist,
  NSFWPolicyType,
  User as ServerUserModel,
  UserRight,
  UserRole,
  UserVideoQuota
} from '@shared/models'
import { TokenOptions, Tokens } from '@root-helpers/pure-auth-user.model'

export class AuthUser extends User implements ServerMyUserModel {
  tokens: Tokens
  specialPlaylists: MyUserSpecialPlaylist[]

  canSeeVideosLink = true

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

  computeCanSeeVideosLink (quotaObservable: Observable<UserVideoQuota>): Observable<boolean> {
    if (!this.isUploadDisabled()) {
      this.canSeeVideosLink = true
      return of(this.canSeeVideosLink)
    }

    // Check if the user has videos
    return quotaObservable.pipe(
      map(({ videoQuotaUsed }) => {
        if (videoQuotaUsed !== 0) {
          // User already uploaded videos, so it can see the link
          this.canSeeVideosLink = true
        } else {
          // No videos, no upload so the user don't need to see the videos link
          this.canSeeVideosLink = false
        }

        return this.canSeeVideosLink
      })
    )
  }
}
