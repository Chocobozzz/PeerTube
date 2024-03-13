export interface ActivityPubOrderedCollection<T> {
  id: string

  '@context': any[]
  type: 'OrderedCollection' | 'OrderedCollectionPage'
  totalItems: number
  orderedItems: T[]

  partOf?: string
  next?: string
  first?: string
}
