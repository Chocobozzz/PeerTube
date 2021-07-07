import { VideoFilter } from '../videos'
import { BooleanBothQuery } from './boolean-both-query.model'

// These query parameters can be used with any endpoint that list videos
export interface VideosCommonQuery {
  start?: number
  count?: number
  sort?: string

  nsfw?: BooleanBothQuery

  isLive?: boolean

  categoryOneOf?: number[]

  licenceOneOf?: number[]

  languageOneOf?: string[]

  tagsOneOf?: string[]
  tagsAllOf?: string[]

  filter?: VideoFilter
}

export interface VideosWithSearchCommonQuery extends VideosCommonQuery {
  search?: string
}
