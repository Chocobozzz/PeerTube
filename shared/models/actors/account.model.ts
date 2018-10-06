import { Actor } from './actor.model'

export interface Account extends Actor {
  displayName: string
  description: string

  userId?: number
}
