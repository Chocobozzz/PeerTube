import { User } from '@app/core/users/user.model'
import { VideoChannel } from '@app/shared/shared-main/channel/video-channel.model'
import { hasUserRight } from '@peertube/peertube-core-utils'
import {
  MyUserSpecialPlaylist,
  MyUser as ServerMyUserModel,
  User as ServerUserModel,
  UserRightType,
  UserRole
} from '@peertube/peertube-models'
import { OAuthUserTokens } from '@root-helpers/users'

export class AuthUser extends User implements ServerMyUserModel {
  oauthTokens: OAuthUserTokens
  specialPlaylists: MyUserSpecialPlaylist[]
  videoChannelCollaborations?: ServerMyUserModel['videoChannelCollaborations']

  constructor (userHash: Partial<ServerMyUserModel>, hashTokens: Partial<OAuthUserTokens>) {
    super(userHash)

    this.oauthTokens = new OAuthUserTokens(hashTokens)
    this.specialPlaylists = userHash.specialPlaylists
    this.videoChannelCollaborations = userHash.videoChannelCollaborations
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

  hasRight (right: UserRightType) {
    return hasUserRight(this.role.id, right)
  }

  canManage (user: ServerUserModel) {
    const myRole = this.role.id

    if (myRole === UserRole.ADMINISTRATOR) return true

    // I'm a moderator: I can only manage users
    return user.role.id === UserRole.USER
  }

  isCollaboratingToChannels () {
    return this.videoChannelCollaborations.length !== 0
  }

  isEditorOfChannel (channel: Pick<VideoChannel, 'id'>) {
    return this.videoChannelCollaborations.some(c => c.id === channel.id)
  }

  isOwnerOfChannel (channel: Pick<VideoChannel, 'id'>) {
    return this.videoChannels.some(c => c.id === channel.id)
  }
}
