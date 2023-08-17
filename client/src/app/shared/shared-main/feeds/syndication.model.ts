import { FeedFormatType } from '@peertube/peertube-models'

export interface Syndication {
  format: FeedFormatType
  label: string
  url: string
}
