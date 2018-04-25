import { Actor } from '../actors/actor.model'
import { Video } from './video.model'

export interface VideoChannel extends Actor {
  displayName: string
  description: string
  support: string
  isLocal: boolean
  ownerAccount?: {
    id: number
    uuid: string
  }
}
