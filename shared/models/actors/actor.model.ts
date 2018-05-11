import { Avatar } from '../avatars/avatar.model'

export interface Actor {
  id: number
  uuid: string
  url: string
  name: string
  host: string
  followingCount: number
  followersCount: number
  createdAt: Date | string
  updatedAt: Date | string
  avatar: Avatar
}
