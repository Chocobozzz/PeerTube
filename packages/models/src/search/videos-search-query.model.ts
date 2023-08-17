import { SearchTargetQuery } from './search-target-query.model.js'
import { VideosCommonQuery } from './videos-common-query.model.js'

export interface VideosSearchQuery extends SearchTargetQuery, VideosCommonQuery {
  search?: string

  host?: string

  startDate?: string // ISO 8601
  endDate?: string // ISO 8601

  originallyPublishedStartDate?: string // ISO 8601
  originallyPublishedEndDate?: string // ISO 8601

  durationMin?: number // seconds
  durationMax?: number // seconds

  // UUIDs or short UUIDs
  uuids?: string[]
}

export interface VideosSearchQueryAfterSanitize extends VideosSearchQuery {
  start: number
  count: number
  sort: string
}
