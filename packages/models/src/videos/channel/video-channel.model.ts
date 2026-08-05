import { Account, ActorImage } from '../../actors/index.js'
import { Actor } from '../../actors/actor.model.js'

export type ViewsPerDate = {
  date: Date
  views: number
}

// 0 means "all time" (no lower bound on the date range)
export const VIDEO_CHANNEL_STATS_DAYS_ALL_TIME = 0

export const VIDEO_CHANNEL_STATS_DAYS_OPTIONS = [ 30, 90, 365, VIDEO_CHANNEL_STATS_DAYS_ALL_TIME ] as const

export type VideoChannelStatsDays = typeof VIDEO_CHANNEL_STATS_DAYS_OPTIONS[number]

// Bucket size used for viewsPerDay points. Chosen from the effective data span
// (min(selected range, channel history)), not from the preset alone.
export type VideoChannelStatsGroupInterval = 'day' | 'week' | 'month'

// ~2 months → daily; up to a bit over a year → weekly; longer → monthly
export function getVideoChannelStatsGroupIntervalFromSpan (spanDays: number): VideoChannelStatsGroupInterval {
  if (spanDays > 400) return 'month'
  if (spanDays >= 60) return 'week'
  return 'day'
}

export function getVideoChannelStatsGroupInterval (statsDays: VideoChannelStatsDays): VideoChannelStatsGroupInterval {
  // Fallback when only the preset is known (no per-channel history yet).
  // Prefer getVideoChannelStatsGroupIntervalFromSpan when the effective span is available.
  if (statsDays === VIDEO_CHANNEL_STATS_DAYS_ALL_TIME) return 'month'
  return getVideoChannelStatsGroupIntervalFromSpan(statsDays)
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
  viewsPerDay?: ViewsPerDate[] // chronologically ordered; bucket size is viewsGroupInterval
  viewsGroupInterval?: VideoChannelStatsGroupInterval
  // When withStats is true: sum of views in the selected statsDays range (from videoStat)
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
