export interface VideosSearchQuery {
  search: string

  start?: number
  count?: number
  sort?: string

  startDate?: string // ISO 8601
  endDate?: string // ISO 8601

  nsfw?: boolean

  categoryOneOf?: number[]

  licenceOneOf?: number[]

  languageOneOf?: string[]

  tagsOneOf?: string[]
  tagsAllOf?: string[]

  durationMin?: number // seconds
  durationMax?: number // seconds
}
