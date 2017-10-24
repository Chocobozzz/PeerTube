import { UserRole } from './user-role.type'
import { VideoChannel } from '../videos/video-channel.model'

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
