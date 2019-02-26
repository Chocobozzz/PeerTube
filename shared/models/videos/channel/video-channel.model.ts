import { Actor } from '../../actors/actor.model'
import { Account } from '../../actors/index'
import { Avatar } from '../../avatars'

export interface VideoChannel extends Actor {
  displayName: string
  description: string
  support: string
  isLocal: boolean
  ownerAccount?: Account
}

export interface VideoChannelSummary {
  id: number
  uuid: string
  name: string
  displayName: string
  url: string
  host: string
  avatar?: Avatar
}
