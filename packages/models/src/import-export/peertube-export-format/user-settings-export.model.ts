import { UserNotificationSetting } from '../../users/user-notification-setting.model.js'
import { BooleanBothQuery } from '../../search/boolean-both-query.model.js'
import { NSFWPolicyType } from '../../videos/nsfw-policy.type.js'

export interface UserSettingsExportJSON {
  email: string

  nsfwPolicy: NSFWPolicyType

  autoPlayVideo: boolean
  autoPlayNextVideo: boolean
  autoPlayNextVideoPlaylist: boolean

  p2pEnabled: boolean

  videosHistoryEnabled: boolean
  videoLanguages: string[]
  browseVideosCategories: number[]
  browseVideosLive: BooleanBothQuery
  language: string

  theme: string

  createdAt: Date

  notificationSettings: UserNotificationSetting

  archiveFiles?: never
}
