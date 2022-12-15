import { ActorImage } from './actor-image.model'

export interface Actor {
  id: number
  url: string
  name: string
  host: string
  followingCount: number
  followersCount: number
  createdAt: Date | string

  avatars: ActorImage[]

  // TODO: remove, deprecated in 4.2
  avatar: ActorImage
}
