import {
  hasUserRight,
  User as UserServerModel,
  UserNotificationSetting,
  UserRight,
  UserRole
} from '../../../../../shared/models/users'
import { VideoChannel } from '../../../../../shared/models/videos'
import { NSFWPolicyType } from '../../../../../shared/models/videos/nsfw-policy.type'
import { Account } from '@app/shared/account/account.model'
import { Avatar } from '../../../../../shared/models/avatars/avatar.model'
import { UserAdminFlag } from '@shared/models/users/user-flag.model'

export class User implements UserServerModel {
  static KEYS = {
    ID: 'id',
    ROLE: 'role',
    EMAIL: 'email',
    VIDEOS_HISTORY_ENABLED: 'videos-history-enabled',
    USERNAME: 'username',
    NSFW_POLICY: 'nsfw_policy',
    WEBTORRENT_ENABLED: 'peertube-videojs-' + 'webtorrent_enabled',
    AUTO_PLAY_VIDEO: 'auto_play_video',
    SESSION_STORAGE_AUTO_PLAY_NEXT_VIDEO: 'auto_play_next_video',
    AUTO_PLAY_VIDEO_PLAYLIST: 'auto_play_video_playlist',
    THEME: 'last_active_theme',
    VIDEO_LANGUAGES: 'video_languages'
  }

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
  videoAbusesCount?: number
  videoAbusesAcceptedCount?: number
  videoAbusesCreatedCount?: number
  videoCommentsCount?: number

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
    this.videoAbusesCount = hash.videoAbusesCount
    this.videoAbusesAcceptedCount = hash.videoAbusesAcceptedCount
    this.videoAbusesCreatedCount = hash.videoAbusesCreatedCount
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
