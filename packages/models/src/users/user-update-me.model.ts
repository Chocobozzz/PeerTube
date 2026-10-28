import { BooleanBothQuery } from '../search/boolean-both-query.model.js'
import { NSFWPolicyType } from '../videos/nsfw-policy.type.js'
import { VideoAIUsageType } from '../videos/video-ai-usage.enum.js'

export interface UserUpdateMe {
  displayName?: string
  description?: string

  nsfwPolicy?: NSFWPolicyType
  nsfwFlagsDisplayed?: number
  nsfwFlagsHidden?: number
  nsfwFlagsBlurred?: number
  nsfwFlagsWarned?: number

  aiUsagesHidden?: VideoAIUsageType[]

  p2pEnabled?: boolean

  autoPlayVideo?: boolean
  autoPlayNextVideo?: boolean
  autoPlayNextVideoPlaylist?: boolean
  videosHistoryEnabled?: boolean
  videoLanguages?: string[]
  videoCategories?: number[]
  videoLive?: BooleanBothQuery
  language?: string

  email?: string
  currentPassword?: string
  password?: string

  theme?: string

  noInstanceConfigWarningModal?: boolean
  noWelcomeModal?: boolean
  noAccountSetupWarningModal?: boolean
}
