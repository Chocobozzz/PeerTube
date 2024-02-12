import { Activity } from './activity.js'

export interface ActivityPubCollection {
  '@context': any[]
  type: 'Collection' | 'CollectionPage'
  totalItems: number
  partOf?: string
  items: Activity[]
}
