import { NSFWQuery } from './nsfw-query.model'
import { VideoFilter } from '../videos'

export interface VideosSearchQuery {
  search?: string

  start?: number
  count?: number
  sort?: string

  publishedStartDate?: string // ISO 8601
  publishedEndDate?: string // ISO 8601

  originallyPublishedStartYear?: string // ISO 8601
  originallyPublishedEndYear?: string // ISO 8601

  nsfw?: NSFWQuery

  categoryOneOf?: number[]

  licenceOneOf?: number[]

  languageOneOf?: string[]

  tagsOneOf?: string[]
  tagsAllOf?: string[]

  durationMin?: number // seconds
  durationMax?: number // seconds

  filter?: VideoFilter
}
