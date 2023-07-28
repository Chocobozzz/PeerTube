import { VideoPrivacy } from '@shared/models'
import { VideoInclude } from '../videos/video-include.enum'
import { BooleanBothQuery } from './boolean-both-query.model'

// These query parameters can be used with any endpoint that list videos
export interface VideosCommonQuery {
  start?: number
  count?: number
  sort?: string

  nsfw?: BooleanBothQuery

  isLive?: boolean

  isLocal?: boolean
  include?: VideoInclude

  categoryOneOf?: number[]

  licenceOneOf?: number[]

  languageOneOf?: string[]

  privacyOneOf?: VideoPrivacy[]

  tagsOneOf?: string[]
  tagsAllOf?: string[]

  hasHLSFiles?: boolean

  hasWebtorrentFiles?: boolean // TODO: remove in v7
  hasWebVideoFiles?: boolean

  skipCount?: boolean

  search?: string

  excludeAlreadyWatched?: boolean
}

export interface VideosCommonQueryAfterSanitize extends VideosCommonQuery {
  start: number
  count: number
  sort: string
}
