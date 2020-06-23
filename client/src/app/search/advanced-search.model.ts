import { NSFWQuery, SearchTargetType } from '@shared/models'

export class AdvancedSearch {
  startDate: string // ISO 8601
  endDate: string // ISO 8601

  originallyPublishedStartDate: string // ISO 8601
  originallyPublishedEndDate: string // ISO 8601

  nsfw: NSFWQuery

  categoryOneOf: string

  licenceOneOf: string

  languageOneOf: string

  tagsOneOf: string
  tagsAllOf: string

  durationMin: number // seconds
  durationMax: number // seconds

  sort: string

  searchTarget: SearchTargetType

  // Filters we don't want to count, because they are mandatory
  private silentFilters = new Set([ 'sort', 'searchTarget' ])

  constructor (options?: {
    startDate?: string
    endDate?: string
    originallyPublishedStartDate?: string
    originallyPublishedEndDate?: string
    nsfw?: NSFWQuery
    categoryOneOf?: string
    licenceOneOf?: string
    languageOneOf?: string
    tagsOneOf?: string
    tagsAllOf?: string
    durationMin?: string
    durationMax?: string
    sort?: string
    searchTarget?: SearchTargetType
  }) {
    if (!options) return

    this.startDate = options.startDate || undefined
    this.endDate = options.endDate || undefined
    this.originallyPublishedStartDate = options.originallyPublishedStartDate || undefined
    this.originallyPublishedEndDate = options.originallyPublishedEndDate || undefined

    this.nsfw = options.nsfw || undefined
    this.categoryOneOf = options.categoryOneOf || undefined
    this.licenceOneOf = options.licenceOneOf || undefined
    this.languageOneOf = options.languageOneOf || undefined
    this.tagsOneOf = options.tagsOneOf || undefined
    this.tagsAllOf = options.tagsAllOf || undefined
    this.durationMin = parseInt(options.durationMin, 10)
    this.durationMax = parseInt(options.durationMax, 10)

    this.searchTarget = options.searchTarget || undefined

    if (isNaN(this.durationMin)) this.durationMin = undefined
    if (isNaN(this.durationMax)) this.durationMax = undefined

    this.sort = options.sort || '-match'
  }

  containsValues () {
    const exceptions = new Set([ 'sort', 'searchTarget' ])

    const obj = this.toUrlObject()
    for (const k of Object.keys(obj)) {
      if (this.silentFilters.has(k)) continue

      if (obj[k] !== undefined && obj[k] !== '') return true
    }

    return false
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
      sort: this.sort,
      searchTarget: this.searchTarget
    }
  }

  toAPIObject () {
    return {
      startDate: this.startDate,
      endDate: this.endDate,
      originallyPublishedStartDate: this.originallyPublishedStartDate,
      originallyPublishedEndDate: this.originallyPublishedEndDate,
      nsfw: this.nsfw,
      categoryOneOf: this.intoArray(this.categoryOneOf),
      licenceOneOf: this.intoArray(this.licenceOneOf),
      languageOneOf: this.intoArray(this.languageOneOf),
      tagsOneOf: this.intoArray(this.tagsOneOf),
      tagsAllOf: this.intoArray(this.tagsAllOf),
      durationMin: this.durationMin,
      durationMax: this.durationMax,
      sort: this.sort,
      searchTarget: this.searchTarget
    }
  }

  size () {
    let acc = 0

    const obj = this.toUrlObject()
    for (const k of Object.keys(obj)) {
      if (this.silentFilters.has(k)) continue

      if (obj[k] !== undefined && obj[k] !== '') acc++
    }

    return acc
  }

  private intoArray (value: any) {
    if (!value) return undefined
    if (Array.isArray(value)) return value

    if (typeof value === 'string') return value.split(',')

    return [ value ]
  }
}
