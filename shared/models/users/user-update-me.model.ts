import { NSFWPolicyType } from '../videos/nsfw-policy.type'
import { WebTorrentPolicyType } from './user-webtorrent-policy.type'

export interface UserUpdateMe {
  displayName?: string
  description?: string
  nsfwPolicy?: NSFWPolicyType,
  webTorrentPolicy?: WebTorrentPolicyType,
  autoPlayVideo?: boolean
  email?: string
  currentPassword?: string
  password?: string
}
