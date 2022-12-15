import { ActorImage } from './actor-image.model'
import { Actor } from './actor.model'

export interface Account extends Actor {
  displayName: string
  description: string
  avatars: ActorImage[]

  updatedAt: Date | string

  userId?: number
}

export interface AccountSummary {
  id: number
  name: string
  displayName: string
  url: string
  host: string

  avatars: ActorImage[]

  // TODO: remove, deprecated in 4.2
  avatar: ActorImage
}
