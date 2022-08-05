import { NSFWPolicyType } from '../videos/nsfw-policy.type'

export interface UserUpdateMe {
  displayName?: string
  description?: string
  nsfwPolicy?: NSFWPolicyType

  // FIXME: deprecated in favour of p2pEnabled in 4.1
  webTorrentEnabled?: boolean
  p2pEnabled?: boolean

  autoPlayVideo?: boolean
  autoPlayNextVideo?: boolean
  autoPlayNextVideoPlaylist?: boolean
  videosHistoryEnabled?: boolean
  videoLanguages?: string[]

  email?: string
  currentPassword?: string
  password?: string

  theme?: string

  noInstanceConfigWarningModal?: boolean
  noWelcomeModal?: boolean
  noAccountSetupWarningModal?: boolean
}
