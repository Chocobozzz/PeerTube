import { Activity } from './activity'

export interface ActivityPubOrderedCollection<T> {
  '@context': string[]
  type: 'OrderedCollection' | 'OrderedCollectionPage'
  totalItems: number
  partOf?: string
  orderedItems: T[]
}
