import {
  ActivityIconObject,
  ActivityIdentifierObject, ActivityPubAttributedTo,
  ActivityTagObject,
  ActivityUrlObject
} from './common-objects'
import { ActivityPubOrderedCollection } from '../activitypub-ordered-collection'

export interface VideoTorrentObject {
  type: 'Video'
  id: string
  name: string
  duration: string
  uuid: string
  tag: ActivityTagObject[]
  category: ActivityIdentifierObject
  licence: ActivityIdentifierObject
  language: ActivityIdentifierObject
  views: number
  sensitive: boolean
  commentsEnabled: boolean
  published: string
  updated: string
  mediaType: 'text/markdown'
  content: string
  icon: ActivityIconObject
  url: ActivityUrlObject[]
  likes?: ActivityPubOrderedCollection<string>
  dislikes?: ActivityPubOrderedCollection<string>
  shares?: ActivityPubOrderedCollection<string>
  comments?: ActivityPubOrderedCollection<string>
  attributedTo: ActivityPubAttributedTo[]
  to?: string[]
  cc?: string[]
}
