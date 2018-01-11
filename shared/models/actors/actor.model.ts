import { Avatar } from '../avatars/avatar.model'

export interface Actor {
  id: number
  uuid: string
  url: string
  name: string
  host: string
  followingCount: number
  followersCount: number
  createdAt: Date
  updatedAt: Date
  avatar: Avatar
}
