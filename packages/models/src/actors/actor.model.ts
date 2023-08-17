import { ActorImage } from './actor-image.model.js'

export interface Actor {
  id: number
  url: string
  name: string
  host: string
  followingCount: number
  followersCount: number
  createdAt: Date | string

  avatars: ActorImage[]
}
