import { Actor } from '../../actors/actor.model'
import { Account } from '../../actors/index'
import { Avatar } from '../../avatars'

export type viewsPerTime = {
  date: Date
  views: number
}

export interface VideoChannel extends Actor {
  displayName: string
  description: string
  support: string
  isLocal: boolean
  ownerAccount?: Account
  viewsPerDay?: viewsPerTime[] // chronologically ordered
}

export interface VideoChannelSummary {
  id: number
  name: string
  displayName: string
  url: string
  host: string
  avatar?: Avatar
}
