import { Avatar } from '../avatars/avatar.model'

export interface Actor {
  id: number
  url: string
  name: string
  host: string
  followingCount: number
  followersCount: number
  createdAt: Date | string
  updatedAt: Date | string
  avatar?: Avatar
}
