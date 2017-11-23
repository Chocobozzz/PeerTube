import {
  ActivityIconObject,
  ActivityIdentifierObject,
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
  nsfw: boolean
  published: string
  updated: string
  mediaType: 'text/markdown'
  content: string
  icon: ActivityIconObject
  url: ActivityUrlObject[]
  actor?: string
  likes?: ActivityPubOrderedCollection<string>
  dislikes?: ActivityPubOrderedCollection<string>
}
