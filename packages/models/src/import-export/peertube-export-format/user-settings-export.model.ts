import { UserNotificationSetting } from '../../users/user-notification-setting.model.js'
import { BooleanBothQuery } from '../../search/boolean-both-query.model.js'
import { NSFWPolicyType } from '../../videos/nsfw-policy.type.js'
import { VideoAIUsageType } from '../../videos/video-ai-usage.enum.js'

export interface UserSettingsExportJSON {
  email: string

  nsfwPolicy: NSFWPolicyType

  aiUsagesHidden: VideoAIUsageType[]

  autoPlayVideo: boolean
  autoPlayNextVideo: boolean
  autoPlayNextVideoPlaylist: boolean

  p2pEnabled: boolean

  videosHistoryEnabled: boolean
  videoLanguages: string[]
  videoCategories: number[]
  videoLive: BooleanBothQuery
  language: string

  theme: string

  createdAt: Date

  notificationSettings: UserNotificationSetting

  archiveFiles?: never
}
