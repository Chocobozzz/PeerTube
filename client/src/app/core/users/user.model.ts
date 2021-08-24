import { Account } from '@app/shared/shared-main/account/account.model'
import { hasUserRight } from '@shared/core-utils/users'
import {
  ActorImage,
  NSFWPolicyType,
  User as UserServerModel,
  UserAdminFlag,
  UserNotificationSetting,
  UserRight,
  UserRole,
  VideoChannel
} from '@shared/models'

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
  autoPlayNextVideoPlaylist: boolean
  webTorrentEnabled: boolean
  videosHistoryEnabled: boolean
  videoLanguages: string[]

  role: UserRole
  roleLabel: string

  videoQuota: number
  videoQuotaDaily: number
  videoQuotaUsed?: number
  videoQuotaUsedDaily?: number

  videosCount?: number
  videoCommentsCount?: number

  abusesCount?: number
  abusesAcceptedCount?: number
  abusesCreatedCount?: number

  theme: string

  account: Account
  notificationSettings?: UserNotificationSetting
  videoChannels?: VideoChannel[]

  blocked: boolean
  blockedReason?: string

  noInstanceConfigWarningModal: boolean
  noWelcomeModal: boolean

  pluginAuth: string | null

  lastLoginDate: Date | null

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
    this.videosCount = hash.videosCount
    this.abusesCount = hash.abusesCount
    this.abusesAcceptedCount = hash.abusesAcceptedCount
    this.abusesCreatedCount = hash.abusesCreatedCount
    this.videoCommentsCount = hash.videoCommentsCount

    this.nsfwPolicy = hash.nsfwPolicy
    this.webTorrentEnabled = hash.webTorrentEnabled
    this.autoPlayVideo = hash.autoPlayVideo
    this.autoPlayNextVideo = hash.autoPlayNextVideo
    this.autoPlayNextVideoPlaylist = hash.autoPlayNextVideoPlaylist
    this.videosHistoryEnabled = hash.videosHistoryEnabled
    this.videoLanguages = hash.videoLanguages

    this.theme = hash.theme

    this.adminFlags = hash.adminFlags

    this.blocked = hash.blocked
    this.blockedReason = hash.blockedReason

    this.noInstanceConfigWarningModal = hash.noInstanceConfigWarningModal
    this.noWelcomeModal = hash.noWelcomeModal

    this.notificationSettings = hash.notificationSettings

    this.createdAt = hash.createdAt

    this.pluginAuth = hash.pluginAuth
    this.lastLoginDate = hash.lastLoginDate

    if (hash.account !== undefined) {
      this.account = new Account(hash.account)
    }
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

  updateAccountAvatar (newAccountAvatar?: ActorImage) {
    if (newAccountAvatar) this.account.updateAvatar(newAccountAvatar)
    else this.account.resetAvatar()
  }

  isUploadDisabled () {
    return this.videoQuota === 0 || this.videoQuotaDaily === 0
  }

  isAutoBlocked () {
    return this.role === UserRole.USER && this.adminFlags !== UserAdminFlag.BYPASS_VIDEO_AUTO_BLACKLIST
  }

  hasNoQuotaLeft () {
    // unlimited videoQuota
    if (this.videoQuota === -1) return false

    // no more videoQuota
    if (!this.videoQuotaUsed) return true

    // videoQuota left lower than 10%
    return this.videoQuotaUsed > this.videoQuota * 0.9
  }

  hasNoQuotaLeftDaily () {
    // unlimited videoQuotaDaily
    if (this.videoQuotaDaily === -1) return false

    // no more videoQuotaDaily
    if (!this.videoQuotaUsedDaily) return true

    // videoQuotaDaily left lower than 10%
    return this.videoQuotaUsedDaily > this.videoQuotaDaily * 0.9
  }
}
