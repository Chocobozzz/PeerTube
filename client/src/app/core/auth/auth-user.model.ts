import { Observable, of } from 'rxjs'
import { map } from 'rxjs/operators'
import { User } from '@app/core/users/user.model'
import { OAuthUserTokens } from '@root-helpers/users'
import { hasUserRight } from '@shared/core-utils/users'
import {
  MyUser as ServerMyUserModel,
  MyUserSpecialPlaylist,
  User as ServerUserModel,
  UserRight,
  UserRole,
  UserVideoQuota
} from '@shared/models'

export class AuthUser extends User implements ServerMyUserModel {
  oauthTokens: OAuthUserTokens
  specialPlaylists: MyUserSpecialPlaylist[]

  canSeeVideosLink = true

  constructor (userHash: Partial<ServerMyUserModel>, hashTokens: Partial<OAuthUserTokens>) {
    super(userHash)

    this.oauthTokens = new OAuthUserTokens(hashTokens)
    this.specialPlaylists = userHash.specialPlaylists
  }

  getAccessToken () {
    return this.oauthTokens.accessToken
  }

  getRefreshToken () {
    return this.oauthTokens.refreshToken
  }

  getTokenType () {
    return this.oauthTokens.tokenType
  }

  refreshTokens (accessToken: string, refreshToken: string) {
    this.oauthTokens.accessToken = accessToken
    this.oauthTokens.refreshToken = refreshToken
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
