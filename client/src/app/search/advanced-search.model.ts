import { NSFWQuery } from '../../../../shared/models/search'

export class AdvancedSearch {
  startDate: string // ISO 8601
  endDate: string // ISO 8601

  nsfw: NSFWQuery

  categoryOneOf: string

  licenceOneOf: string

  languageOneOf: string

  tagsOneOf: string
  tagsAllOf: string

  durationMin: number // seconds
  durationMax: number // seconds

  constructor (options?: {
    startDate?: string
    endDate?: string
    nsfw?: NSFWQuery
    categoryOneOf?: string
    licenceOneOf?: string
    languageOneOf?: string
    tagsOneOf?: string
    tagsAllOf?: string
    durationMin?: string
    durationMax?: string
  }) {
    if (!options) return

    this.startDate = options.startDate || undefined
    this.endDate = options.endDate || undefined
    this.nsfw = options.nsfw || undefined
    this.categoryOneOf = options.categoryOneOf || undefined
    this.licenceOneOf = options.licenceOneOf || undefined
    this.languageOneOf = options.languageOneOf || undefined
    this.tagsOneOf = options.tagsOneOf || undefined
    this.tagsAllOf = options.tagsAllOf || undefined
    this.durationMin = parseInt(options.durationMin, 10)
    this.durationMax = parseInt(options.durationMax, 10)

    if (isNaN(this.durationMin)) this.durationMin = undefined
    if (isNaN(this.durationMax)) this.durationMax = undefined
  }

  containsValues () {
    const obj = this.toUrlObject()
    for (const k of Object.keys(obj)) {
      if (obj[k] !== undefined) return true
    }

    return false
  }

  reset () {
    this.startDate = undefined
    this.endDate = undefined
    this.nsfw = undefined
    this.categoryOneOf = undefined
    this.licenceOneOf = undefined
    this.languageOneOf = undefined
    this.tagsOneOf = undefined
    this.tagsAllOf = undefined
    this.durationMin = undefined
    this.durationMax = undefined
  }

  toUrlObject () {
    return {
      startDate: this.startDate,
      endDate: this.endDate,
      nsfw: this.nsfw,
      categoryOneOf: this.categoryOneOf,
      licenceOneOf: this.licenceOneOf,
      languageOneOf: this.languageOneOf,
      tagsOneOf: this.tagsOneOf,
      tagsAllOf: this.tagsAllOf,
      durationMin: this.durationMin,
      durationMax: this.durationMax
    }
  }

  toAPIObject () {
    return {
      startDate: this.startDate,
      endDate: this.endDate,
      nsfw: this.nsfw,
      categoryOneOf: this.categoryOneOf ? this.categoryOneOf.split(',') : undefined,
      licenceOneOf: this.licenceOneOf ? this.licenceOneOf.split(',') : undefined,
      languageOneOf: this.languageOneOf ? this.languageOneOf.split(',') : undefined,
      tagsOneOf: this.tagsOneOf ? this.tagsOneOf.split(',') : undefined,
      tagsAllOf: this.tagsAllOf ? this.tagsAllOf.split(',') : undefined,
      durationMin: this.durationMin,
      durationMax: this.durationMax
    }
  }
}
