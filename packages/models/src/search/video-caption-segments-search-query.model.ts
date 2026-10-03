export type VideoCaptionSegmentsSearchSort = 'match' | '-match'

export interface VideoCaptionSegmentsSearchQuery {
  search: string

  languageOneOf?: string[]

  sort?: VideoCaptionSegmentsSearchSort

  start?: number
  count?: number
}

export interface VideoCaptionSegmentsSearchQueryAfterSanitize extends VideoCaptionSegmentsSearchQuery {
  sort: VideoCaptionSegmentsSearchSort

  start: number
  count: number
}
