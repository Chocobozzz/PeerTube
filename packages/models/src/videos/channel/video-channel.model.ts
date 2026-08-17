import { Account, ActorImage } from '../../actors/index.js'
import { Actor } from '../../actors/actor.model.js'

export type ViewsPerDate = {
  date: Date
  views: number
}

// 0 means "all time" (no lower bound on the date range)
export const VIDEO_CHANNEL_STATS_DAYS_ALL_TIME = 0

export const VIDEO_CHANNEL_STATS_DAYS_DEFAULT = 30

export const VIDEO_CHANNEL_STATS_DAYS_OPTIONS = [ VIDEO_CHANNEL_STATS_DAYS_DEFAULT, 90, 365, VIDEO_CHANNEL_STATS_DAYS_ALL_TIME ] as const

export type VideoChannelStatsDays = typeof VIDEO_CHANNEL_STATS_DAYS_OPTIONS[number]

// Bucket size used for viewsPerDay points
export type VideoChannelStatsGroupInterval = 'day' | 'week' | 'month'

// ~2 months → daily; up to a bit over a year → weekly; longer → monthly
// Also used to build the SQL that computes viewsGroupInterval server side
export const VIDEO_CHANNEL_STATS_MONTH_GROUP_THRESHOLD_DAYS = 400
export const VIDEO_CHANNEL_STATS_WEEK_GROUP_THRESHOLD_DAYS = 60

// Fallback for when viewsGroupInterval is not available yet. Exact for a bounded range, best effort
// for "all time" where only the server knows the channel history
export function getVideoChannelStatsGroupInterval (statsDays: VideoChannelStatsDays): VideoChannelStatsGroupInterval {
  if (statsDays === VIDEO_CHANNEL_STATS_DAYS_ALL_TIME) return 'month'
  if (statsDays > VIDEO_CHANNEL_STATS_MONTH_GROUP_THRESHOLD_DAYS) return 'month'
  if (statsDays >= VIDEO_CHANNEL_STATS_WEEK_GROUP_THRESHOLD_DAYS) return 'week'

  return 'day'
}

export interface VideoChannel extends Actor {
  displayName: string
  description: string
  support: string
  publicEmail?: string
  isLocal: boolean

  updatedAt: Date | string

  ownerAccount?: Account

  videosCount?: number
  // Chronologically ordered, always spans the whole requested statsDays range so channels can be compared to each other
  // Bucket size is viewsGroupInterval
  viewsPerDay?: ViewsPerDate[]
  viewsGroupInterval?: VideoChannelStatsGroupInterval
  // Lifetime views of all the channel videos, not bound to the selected statsDays range
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

export function isVideoChannel (obj: Account | VideoChannel): obj is VideoChannel {
  return obj && typeof obj === 'object' && 'support' in obj
}
