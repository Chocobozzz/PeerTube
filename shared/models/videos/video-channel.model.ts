import { Actor } from '../actors/actor.model'
import { Video } from './video.model'

export interface VideoChannel extends Actor {
  displayName: string
  description: string
  isLocal: boolean
  owner?: {
    name: string
    uuid: string
  }
  videos?: Video[]
}
