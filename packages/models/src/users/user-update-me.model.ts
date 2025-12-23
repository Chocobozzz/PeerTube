import { NSFWPolicyType } from '../videos/nsfw-policy.type.js'

export interface UserUpdateMe {
  displayName?: string
  description?: string

  nsfwPolicy?: NSFWPolicyType
  nsfwFlagsDisplayed?: number
  nsfwFlagsHidden?: number
  nsfwFlagsBlurred?: number
  nsfwFlagsWarned?: number

  p2pEnabled?: boolean

  autoPlayVideo?: boolean
  autoPlayNextVideo?: boolean
  autoPlayNextVideoPlaylist?: boolean
  videosHistoryEnabled?: boolean
  videoLanguages?: string[]
  language?: string

  email?: string
  emailPublic?: boolean
  currentPassword?: string
  password?: string

  theme?: string

  noInstanceConfigWarningModal?: boolean
  noWelcomeModal?: boolean
  noAccountSetupWarningModal?: boolean
}
