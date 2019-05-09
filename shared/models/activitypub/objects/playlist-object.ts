import { ActivityIconObject } from './common-objects'

export interface PlaylistObject {
  id: string
  type: 'Playlist'

  name: string
  content: string
  uuid: string

  totalItems: number
  attributedTo: string[]

  icon?: ActivityIconObject

  published: string
  updated: string

  orderedItems?: string[]

  partOf?: string
  next?: string
  first?: string

  to?: string[]
}
