import { Avatar } from '../avatars/avatar.model'

export interface Account {
  id: number
  uuid: string
  url: string
  name: string
  displayName: string
  host: string
  followingCount: number
  followersCount: number
  createdAt: Date
  updatedAt: Date
  avatar: Avatar
}
