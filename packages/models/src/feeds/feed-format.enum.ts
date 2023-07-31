export const FeedFormat = {
  RSS: 'xml',
  ATOM: 'atom',
  JSON: 'json'
} as const

export type FeedFormatType = typeof FeedFormat[keyof typeof FeedFormat]
