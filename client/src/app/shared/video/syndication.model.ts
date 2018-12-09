import { FeedFormat } from '../../../../../shared/models/feeds/feed-format.enum'

export interface Syndication {
  format: FeedFormat,
  label: string,
  url: string
}
