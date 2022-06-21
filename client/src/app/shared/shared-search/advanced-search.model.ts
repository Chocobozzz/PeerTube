import { intoArray } from '@app/helpers'
import {
  BooleanBothQuery,
  BooleanQuery,
  SearchTargetType,
  VideoChannelsSearchQuery,
  VideoPlaylistsSearchQuery,
  VideosSearchQuery
} from '@shared/models'

export type AdvancedSearchResultType = 'videos' | 'playlists' | 'channels'

export class AdvancedSearch {
  startDate: string // ISO 8601
  endDate: string // ISO 8601

  originallyPublishedStartDate: string // ISO 8601
  originallyPublishedEndDate: string // ISO 8601

  nsfw: BooleanBothQuery

  categoryOneOf: string

  licenceOneOf: string

  languageOneOf: string

  tagsOneOf: string[]
  tagsAllOf: string[]

  durationMin: number // seconds
  durationMax: number // seconds

  isLive: BooleanQuery

  host: string

  sort: string

  searchTarget: SearchTargetType
  resultType: AdvancedSearchResultType

  constructor (options?: {
    startDate?: string
    endDate?: string
    originallyPublishedStartDate?: string
    originallyPublishedEndDate?: string
    nsfw?: BooleanBothQuery
    categoryOneOf?: string
    licenceOneOf?: string
    languageOneOf?: string

    tagsOneOf?: any
    tagsAllOf?: any

    isLive?: BooleanQuery

    host?: string

    durationMin?: string
    durationMax?: string
    sort?: string
    searchTarget?: SearchTargetType
    resultType?: AdvancedSearchResultType
  }) {
    if (!options) return

    this.startDate = options.startDate || undefined
    this.endDate = options.endDate || undefined
    this.originallyPublishedStartDate = options.originallyPublishedStartDate || undefined
    this.originallyPublishedEndDate = options.originallyPublishedEndDate || undefined

    this.nsfw = options.nsfw || undefined
    this.isLive = options.isLive || undefined

    this.categoryOneOf = options.categoryOneOf || undefined
    this.licenceOneOf = options.licenceOneOf || undefined
    this.languageOneOf = options.languageOneOf || undefined
    this.tagsOneOf = intoArray(options.tagsOneOf)
    this.tagsAllOf = intoArray(options.tagsAllOf)
    this.durationMin = options.durationMin ? parseInt(options.durationMin, 10) : undefined
    this.durationMax = options.durationMax ? parseInt(options.durationMax, 10) : undefined

    this.host = options.host || undefined

    this.searchTarget = options.searchTarget || undefined

    this.resultType = options.resultType || undefined

    if (!this.resultType && this.hasVideoFilter()) {
      this.resultType = 'videos'
    }

    if (isNaN(this.durationMin)) this.durationMin = undefined
    if (isNaN(this.durationMax)) this.durationMax = undefined

    this.sort = options.sort || '-match'
  }

  containsValues () {
    return this.size() !== 0
  }

  reset () {
    this.startDate = undefined
    this.endDate = undefined
    this.originallyPublishedStartDate = undefined
    this.originallyPublishedEndDate = undefined
    this.nsfw = undefined
    this.categoryOneOf = undefined
    this.licenceOneOf = undefined
    this.languageOneOf = undefined
    this.tagsOneOf = undefined
    this.tagsAllOf = undefined
    this.durationMin = undefined
    this.durationMax = undefined
    this.isLive = undefined
    this.host = undefined

    this.sort = '-match'
  }

  toUrlObject () {
    return {
      startDate: this.startDate,
      endDate: this.endDate,
      originallyPublishedStartDate: this.originallyPublishedStartDate,
      originallyPublishedEndDate: this.originallyPublishedEndDate,
      nsfw: this.nsfw,
      categoryOneOf: this.categoryOneOf,
      licenceOneOf: this.licenceOneOf,
      languageOneOf: this.languageOneOf,
      tagsOneOf: this.tagsOneOf,
      tagsAllOf: this.tagsAllOf,
      durationMin: this.durationMin,
      durationMax: this.durationMax,
      isLive: this.isLive,
      host: this.host,
      sort: this.sort,
      searchTarget: this.searchTarget,
      resultType: this.resultType
    }
  }

  toVideosAPIObject (): VideosSearchQuery {
    let isLive: boolean
    if (this.isLive) isLive = this.isLive === 'true'

    return {
      startDate: this.startDate,
      endDate: this.endDate,
      originallyPublishedStartDate: this.originallyPublishedStartDate,
      originallyPublishedEndDate: this.originallyPublishedEndDate,
      nsfw: this.nsfw,
      categoryOneOf: intoArray(this.categoryOneOf),
      licenceOneOf: intoArray(this.licenceOneOf),
      languageOneOf: intoArray(this.languageOneOf),
      tagsOneOf: this.tagsOneOf,
      tagsAllOf: this.tagsAllOf,
      durationMin: this.durationMin,
      durationMax: this.durationMax,
      host: this.host,
      isLive,
      sort: this.sort,
      searchTarget: this.searchTarget
    }
  }

  toPlaylistAPIObject (): VideoPlaylistsSearchQuery {
    return {
      host: this.host,
      searchTarget: this.searchTarget
    }
  }

  toChannelAPIObject (): VideoChannelsSearchQuery {
    return {
      host: this.host,
      searchTarget: this.searchTarget
    }
  }

  size () {
    let acc = 0

    if (this.isValidValue(this.startDate) || this.isValidValue(this.endDate)) acc++
    if (this.isValidValue(this.originallyPublishedStartDate) || this.isValidValue(this.originallyPublishedEndDate)) acc++

    if (this.isValidValue(this.nsfw)) acc++
    if (this.isValidValue(this.categoryOneOf)) acc++
    if (this.isValidValue(this.licenceOneOf)) acc++
    if (this.isValidValue(this.languageOneOf)) acc++
    if (this.isValidValue(this.tagsOneOf)) acc++
    if (this.isValidValue(this.tagsAllOf)) acc++
    if (this.isValidValue(this.durationMin) || this.isValidValue(this.durationMax)) acc++
    if (this.isValidValue(this.isLive)) acc++
    if (this.isValidValue(this.host)) acc++
    if (this.isValidValue(this.resultType)) acc++

    return acc
  }

  private isValidValue (val: any) {
    if (val === undefined) return false
    if (val === '') return false
    if (Array.isArray(val) && val.length === 0) return false

    return true
  }

  private hasVideoFilter () {
    return this.startDate !== undefined ||
      this.endDate !== undefined ||
      this.originallyPublishedStartDate !== undefined ||
      this.originallyPublishedEndDate !== undefined ||
      this.nsfw !== undefined ||
      this.categoryOneOf !== undefined ||
      this.licenceOneOf !== undefined ||
      this.languageOneOf !== undefined ||
      this.tagsOneOf !== undefined ||
      this.tagsAllOf !== undefined ||
      this.durationMin !== undefined ||
      this.durationMax !== undefined ||
      this.host !== undefined ||
      this.isLive !== undefined
  }
}
