import { NSFWPolicyType } from '../videos/nsfw-policy.type'

export interface UserUpdateMe {
  displayName?: string
  description?: string
  nsfwPolicy?: NSFWPolicyType
  autoPlayVideo?: boolean
  email?: string
  password?: string
}
