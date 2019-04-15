import { hasUserRight, User as UserServerModel, UserNotificationSetting, UserRight, UserRole, VideoChannel } from '../../../../../shared'
import { NSFWPolicyType } from '../../../../../shared/models/videos/nsfw-policy.type'
import { Account } from '@app/shared/account/account.model'
import { Avatar } from '../../../../../shared/models/avatars/avatar.model'
import { UserAdminFlag } from '@shared/models/users/user-flag.model'

export class User implements UserServerModel {
  id: number
  username: string
  email: string
  emailVerified: boolean
  nsfwPolicy: NSFWPolicyType

  role: UserRole
  roleLabel: string

  webTorrentEnabled: boolean
  autoPlayVideo: boolean
  videosHistoryEnabled: boolean

  videoQuota: number
  videoQuotaDaily: number
  account: Account
  videoChannels: VideoChannel[]
  createdAt: Date

  adminFlags?: UserAdminFlag

  blocked: boolean
  blockedReason?: string

  notificationSettings?: UserNotificationSetting

  constructor (hash: Partial<UserServerModel>) {
    this.id = hash.id
    this.username = hash.username
    this.email = hash.email

    this.role = hash.role

    this.videoChannels = hash.videoChannels
    this.videoQuota = hash.videoQuota
    this.videoQuotaDaily = hash.videoQuotaDaily
    this.nsfwPolicy = hash.nsfwPolicy
    this.webTorrentEnabled = hash.webTorrentEnabled
    this.videosHistoryEnabled = hash.videosHistoryEnabled
    this.autoPlayVideo = hash.autoPlayVideo
    this.createdAt = hash.createdAt

    this.adminFlags = hash.adminFlags

    this.blocked = hash.blocked
    this.blockedReason = hash.blockedReason

    this.notificationSettings = hash.notificationSettings

    if (hash.account !== undefined) {
      this.account = new Account(hash.account)
    }
  }

  get accountAvatarUrl () {
    if (!this.account) return ''

    return this.account.avatarUrl
  }

  hasRight (right: UserRight) {
    return hasUserRight(this.role, right)
  }

  patch (obj: UserServerModel) {
    for (const key of Object.keys(obj)) {
      this[key] = obj[key]
    }

    if (obj.account !== undefined) {
      this.account = new Account(obj.account)
    }
  }

  updateAccountAvatar (newAccountAvatar: Avatar) {
    this.account.updateAvatar(newAccountAvatar)
  }
}
