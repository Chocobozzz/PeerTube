import { SearchTargetQuery } from './search-target-query.model'

export interface VideoPlaylistsSearchQuery extends SearchTargetQuery {
  search: string

  start?: number
  count?: number
  sort?: string
}
