import { SearchTargetQuery } from "./search-target-query.model"

export interface VideoChannelsSearchQuery extends SearchTargetQuery {
  search: string

  start?: number
  count?: number
  sort?: string
}
