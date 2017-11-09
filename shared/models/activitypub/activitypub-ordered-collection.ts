import { Activity } from './activity'

export interface ActivityPubOrderedCollection {
  '@context': string[]
  type: 'OrderedCollection' | 'OrderedCollectionPage'
  totalItems: number
  partOf?: string
  orderedItems: Activity[]
}
