import { Actor } from '../actors/actor.model'
import { Video } from './video.model'
import { Account } from '../actors'

export interface VideoChannel extends Actor {
  displayName: string
  description: string
  support: string
  isLocal: boolean
  ownerAccount?: Account
}
