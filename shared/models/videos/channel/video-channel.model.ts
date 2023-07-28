import { Account, ActorImage } from '../../actors'
import { Actor } from '../../actors/actor.model'

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
  totalViews?: number

  banners: ActorImage[]
}

export interface VideoChannelSummary {
  id: number
  name: string
  displayName: string
  url: string
  host: string

  avatars: ActorImage[]
}
