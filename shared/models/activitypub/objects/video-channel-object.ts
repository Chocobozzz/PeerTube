import { ActivityPubOrderedCollection } from '../activitypub-ordered-collection'

export interface VideoChannelObject {
  type: 'VideoChannel'
  id: string
  name: string
  content: string
  uuid: string
  published: string
  updated: string
  actor?: string
  shares?: ActivityPubOrderedCollection<string>
}
