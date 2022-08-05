import { Activity } from './activity'

export interface ActivityPubCollection {
  '@context': string[]
  type: 'Collection' | 'CollectionPage'
  totalItems: number
  partOf?: string
  items: Activity[]
}
