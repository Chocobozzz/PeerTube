import { SearchTargetQuery } from './search-target-query.model'
import { VideosCommonQuery } from './videos-common-query.model'

export interface VideosSearchQuery extends SearchTargetQuery, VideosCommonQuery {
  search?: string

  startDate?: string // ISO 8601
  endDate?: string // ISO 8601

  originallyPublishedStartDate?: string // ISO 8601
  originallyPublishedEndDate?: string // ISO 8601

  durationMin?: number // seconds
  durationMax?: number // seconds
}
