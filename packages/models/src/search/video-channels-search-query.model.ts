import { SearchTargetQuery } from './search-target-query.model.js'

export interface VideoChannelsSearchQuery extends SearchTargetQuery {
  search?: string

  start?: number
  count?: number
  sort?: string

  host?: string
  handles?: string[]
}

export interface VideoChannelsSearchQueryAfterSanitize extends VideoChannelsSearchQuery {
  start: number
  count: number
  sort: string
}
