export interface ActivityPubOrderedCollection<T> {
  '@context': string[]
  type: 'OrderedCollection' | 'OrderedCollectionPage'
  totalItems: number
  orderedItems: T[]

  partOf?: string
  next?: string
  first?: string
}
