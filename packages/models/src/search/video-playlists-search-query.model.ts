import { SearchTargetQuery } from './search-target-query.model.js'

export interface VideoPlaylistsSearchQuery extends SearchTargetQuery {
  search?: string

  start?: number
  count?: number
  sort?: string

  host?: string

  // UUIDs or short UUIDs
  uuids?: string[]
}

export interface VideoPlaylistsSearchQueryAfterSanitize extends VideoPlaylistsSearchQuery {
  start: number
  count: number
  sort: string
}
