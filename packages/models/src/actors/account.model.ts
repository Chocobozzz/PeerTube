import { ActorImage } from './actor-image.model.js'
import { Actor } from './actor.model.js'

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
}
