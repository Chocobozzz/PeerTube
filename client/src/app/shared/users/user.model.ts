import { hasUserRight, User as UserServerModel, UserNotificationSetting, UserRight, UserRole, VideoChannel } from '../../../../../shared'
import { NSFWPolicyType } from '../../../../../shared/models/videos/nsfw-policy.type'
import { Account } from '@app/shared/account/account.model'
import { Avatar } from '../../../../../shared/models/avatars/avatar.model'
import { UserAdminFlag } from '@shared/models/users/user-flag.model'

export class User implements UserServerModel {
  id: number
  username: string
  email: string
  pendingEmail: string | null

  emailVerified: boolean
  nsfwPolicy: NSFWPolicyType

  adminFlags?: UserAdminFlag

  autoPlayVideo: boolean
  autoPlayNextVideo: boolean
  webTorrentEnabled: boolean
  videosHistoryEnabled: boolean
  videoLanguages: string[]

  role: UserRole
  roleLabel: string

  videoQuota: number
  videoQuotaDaily: number
  videoQuotaUsed?: number
  videoQuotaUsedDaily?: number

  theme: string

  account: Account
  notificationSettings?: UserNotificationSetting
  videoChannels?: VideoChannel[]

  blocked: boolean
  blockedReason?: string

  noInstanceConfigWarningModal: boolean
  noWelcomeModal: boolean

  createdAt: Date

  constructor (hash: Partial<UserServerModel>) {
    this.id = hash.id
    this.username = hash.username
    this.email = hash.email

    this.role = hash.role

    this.videoChannels = hash.videoChannels

    this.videoQuota = hash.videoQuota
    this.videoQuotaDaily = hash.videoQuotaDaily
    this.videoQuotaUsed = hash.videoQuotaUsed
    this.videoQuotaUsedDaily = hash.videoQuotaUsedDaily

    this.nsfwPolicy = hash.nsfwPolicy
    this.webTorrentEnabled = hash.webTorrentEnabled
    this.videosHistoryEnabled = hash.videosHistoryEnabled
    this.autoPlayVideo = hash.autoPlayVideo

    this.theme = hash.theme

    this.adminFlags = hash.adminFlags

    this.blocked = hash.blocked
    this.blockedReason = hash.blockedReason

    this.noInstanceConfigWarningModal = hash.noInstanceConfigWarningModal
    this.noWelcomeModal = hash.noWelcomeModal

    this.notificationSettings = hash.notificationSettings

    this.createdAt = hash.createdAt

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
