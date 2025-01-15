import { Account } from '@app/shared/shared-main/account/account.model'
import { hasUserRight, objectKeysTyped } from '@peertube/peertube-core-utils'
import {
  ActorImage,
  HTMLServerConfig,
  NSFWPolicyType,
  User as UserServerModel,
  UserAdminFlag,
  UserAdminFlagType,
  UserNotificationSetting,
  UserRightType,
  UserRole,
  UserRoleType,
  VideoChannel
} from '@peertube/peertube-models'

export class User implements UserServerModel {
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
  noAccountSetupWarningModal: boolean

  pluginAuth: string | null

  lastLoginDate: Date | null

  twoFactorEnabled: boolean

  createdAt: Date

  constructor (hash: Partial<UserServerModel>) {
    const { account, ...mergeProps }: Partial<UserServerModel> = hash

    Object.assign(this, mergeProps)

    if (account !== undefined) {
      this.account = new Account(account)
    }
  }

  hasRight (right: UserRightType) {
    return hasUserRight(this.role.id, right)
  }

  patch (obj: UserServerModel) {
    for (const key of objectKeysTyped(obj)) {
      (this as any)[key] = obj[key]
    }

    if (obj.account !== undefined) {
      this.account = new Account(obj.account)
    }
  }

  updateAccountAvatar (newAccountAvatars?: ActorImage[]) {
    if (newAccountAvatars) this.account.updateAvatar(newAccountAvatars)
    else this.account.resetAvatar()
  }

  hasUploadDisabled () {
    return this.videoQuota === 0 || this.videoQuotaDaily === 0
  }

  isAutoBlocked (serverConfig: HTMLServerConfig) {
    if (serverConfig.autoBlacklist.videos.ofUsers.enabled !== true) return false

    return this.role.id === UserRole.USER && this.adminFlags !== UserAdminFlag.BYPASS_VIDEO_AUTO_BLACKLIST
  }
}
