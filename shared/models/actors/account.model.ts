import { ActorImage } from './actor-image.model'
import { Actor } from './actor.model'

export interface Account extends Actor {
  displayName: string
  description: string

  updatedAt: Date | string

  userId?: number
}

export interface AccountSummary {
  id: number
  name: string
  displayName: string
  url: string
  host: string
  avatar?: ActorImage
}
