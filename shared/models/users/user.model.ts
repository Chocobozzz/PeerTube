import { Account } from '../actors'
import { VideoChannel } from '../videos/channel/video-channel.model'
import { UserRole } from './user-role'
import { NSFWPolicyType } from '../videos/nsfw-policy.type'
import { UserNotificationSetting } from './user-notification-setting.model'
import { UserAdminFlag } from './user-flag.model'
import { VideoPlaylistType } from '@shared/models'

export interface User {
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

  abusesCount?: number
  abusesAcceptedCount?: number
  abusesCreatedCount?: number

  videoCommentsCount? : number

  theme: string

  account: Account
  notificationSettings?: UserNotificationSetting
  videoChannels?: VideoChannel[]

  blocked: boolean
  blockedReason?: string

  noInstanceConfigWarningModal: boolean
  noWelcomeModal: boolean

  createdAt: Date

  pluginAuth: string | null

  lastLoginDate: Date | null
}

export interface MyUserSpecialPlaylist {
  id: number
  name: string
  type: VideoPlaylistType
}

export interface MyUser extends User {
  specialPlaylists: MyUserSpecialPlaylist[]
}
