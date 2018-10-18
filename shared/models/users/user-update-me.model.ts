import { NSFWPolicyType } from '../videos/nsfw-policy.type'

export interface UserUpdateMe {
  displayName?: string
  description?: string
  nsfwPolicy?: NSFWPolicyType,
  webTorrentEnabled?: boolean,
  autoPlayVideo?: boolean
  email?: string
  currentPassword?: string
  password?: string
}
