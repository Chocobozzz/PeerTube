import { Account } from '../actors'
import { VideoChannel } from '../videos/channel/video-channel.model'
import { UserRole } from './user-role'
import { NSFWPolicyType } from '../videos/nsfw-policy.type'

export interface User {
  id: number
  username: string
  email: string
  nsfwPolicy: NSFWPolicyType
  autoPlayVideo: boolean
  role: UserRole
  videoQuota: number
  createdAt: Date
  account: Account
  videoChannels?: VideoChannel[]

  blocked: boolean
  blockedReason?: string

  videoQuotaUsed?: number
}
