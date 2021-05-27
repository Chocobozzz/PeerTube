import { Actor } from '../../actors/actor.model'
import { Account, ActorImage } from '../../actors'

export type ViewsPerDate = {
  date: Date
  views: number
}

export interface VideoChannel extends Actor {
  displayName: string
  description: string
  support: string
  isLocal: boolean

  updatedAt: Date | string

  ownerAccount?: Account

  videosCount?: number
  viewsPerDay?: ViewsPerDate[] // chronologically ordered

  banner?: ActorImage
}

export interface VideoChannelSummary {
  id: number
  name: string
  displayName: string
  url: string
  host: string
  avatar?: ActorImage
}
