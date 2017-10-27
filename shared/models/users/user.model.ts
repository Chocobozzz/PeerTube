import { VideoChannel } from '../videos/video-channel.model'
import { UserRole } from './user-role'

export interface User {
  id: number
  username: string
  email: string
  displayNSFW: boolean
  role: UserRole
  videoQuota: number
  createdAt: Date,
  author: {
    id: number
    uuid: string
  }
  videoChannels?: VideoChannel[]
}
