import { Account } from '../accounts'
import { VideoChannel } from '../videos/video-channel.model'
import { UserRole } from './user-role'

export interface User {
  id: number
  username: string
  email: string
  displayNSFW: boolean
  autoPlayVideo: boolean
  role: UserRole
  videoQuota: number
  createdAt: Date
  account: Account
  videoChannels?: VideoChannel[]
}
