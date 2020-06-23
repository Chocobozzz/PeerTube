import { FeedFormat } from '@shared/models'

export interface Syndication {
  format: FeedFormat,
  label: string,
  url: string
}
