import { VideoIncludeType } from '../videos/video-include.enum.js'
import { VideoPrivacyType } from '../videos/video-privacy.enum.js'
import { BooleanBothQuery } from './boolean-both-query.model.js'

// These query parameters can be used with any endpoint that list videos
export interface VideosCommonQuery {
  start?: number
  count?: number
  sort?: string

  nsfw?: BooleanBothQuery

  isLive?: boolean

  isLocal?: boolean
  include?: VideoIncludeType

  categoryOneOf?: number[]

  licenceOneOf?: number[]

  languageOneOf?: string[]

  tagsOneOf?: string[]
  tagsAllOf?: string[]

  hasHLSFiles?: boolean

  hasWebVideoFiles?: boolean

  skipCount?: boolean

  search?: string

  excludeAlreadyWatched?: boolean

  // Only available with special user right
  autoTagOneOf?: string[]
  privacyOneOf?: VideoPrivacyType[]
}

export interface VideosCommonQueryAfterSanitize extends VideosCommonQuery {
  start: number
  count: number
  sort: string
}
