import { Account } from '../actors/index.js'
import { VideoChannel } from '../videos/channel/video-channel.model.js'
import { NSFWPolicyType } from '../videos/nsfw-policy.type.js'
import { VideoPlaylistType_Type } from '../videos/playlist/video-playlist-type.model.js'
import { UserAdminFlagType } from './user-flag.model.js'
import { UserNotificationSetting } from './user-notification-setting.model.js'
import { UserRoleType } from './user-role.js'

export interface User {
  id: number
  username: string
  email: string
  pendingEmail: string | null

  emailVerified: boolean
  emailPublic: boolean
  nsfwPolicy: NSFWPolicyType

  adminFlags?: UserAdminFlagType

  autoPlayVideo: boolean
  autoPlayNextVideo: boolean
  autoPlayNextVideoPlaylist: boolean

  p2pEnabled: boolean

  videosHistoryEnabled: boolean
  videoLanguages: string[]

  role: {
    id: UserRoleType
    label: string
  }

  videoQuota: number
  videoQuotaDaily: number
  videoQuotaUsed?: number
  videoQuotaUsedDaily?: number

  totalVideoFileSize?: number

  videosCount?: number

  abusesCount?: number
  abusesAcceptedCount?: number
  abusesCreatedCount?: number

  videoCommentsCount?: number

  theme: string

  account: Account
  notificationSettings?: UserNotificationSetting
  videoChannels?: VideoChannel[]

  blocked: boolean
  blockedReason?: string

  noInstanceConfigWarningModal: boolean
  noWelcomeModal: boolean
  noAccountSetupWarningModal: boolean

  createdAt: Date

  pluginAuth: string | null

  lastLoginDate: Date | null

  twoFactorEnabled: boolean
}

export interface MyUserSpecialPlaylist {
  id: number
  name: string
  type: VideoPlaylistType_Type
}

export interface MyUser extends User {
  specialPlaylists: MyUserSpecialPlaylist[]
}
