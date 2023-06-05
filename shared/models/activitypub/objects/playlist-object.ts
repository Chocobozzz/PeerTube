import { ActivityIconObject, ActivityPubAttributedTo } from './common-objects'

export interface PlaylistObject {
  id: string
  type: 'Playlist'

  name: string

  content: string
  mediaType: 'text/markdown'

  uuid: string

  totalItems: number
  attributedTo: ActivityPubAttributedTo[]

  icon?: ActivityIconObject

  published: string
  updated: string

  orderedItems?: string[]

  partOf?: string
  next?: string
  first?: string

  to?: string[]
}
