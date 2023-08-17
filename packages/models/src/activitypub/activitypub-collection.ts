import { Activity } from './activity.js'

export interface ActivityPubCollection {
  '@context': string[]
  type: 'Collection' | 'CollectionPage'
  totalItems: number
  partOf?: string
  items: Activity[]
}
