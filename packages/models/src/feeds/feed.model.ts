export const FeedFormat = {
  PODCAST: 'xml',
  RSS: 'xml',
  ATOM: 'atom',
  JSON: 'json'
} as const

export type FeedFormatType = typeof FeedFormat[keyof typeof FeedFormat]

// ---------------------------------------------------------------------------

export const FeedType = {
  VIDEOS: 'videos',
  PODCAST: 'podcast'
} as const

export type FeedType_Type = typeof FeedType[keyof typeof FeedType]

// ---------------------------------------------------------------------------

export type FeedEnclosurePreference = 'video' | 'audio' | 'm3u8'
