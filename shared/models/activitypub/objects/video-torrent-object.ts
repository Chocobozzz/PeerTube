import {
  ActivityIconObject,
  ActivityIdentifierObject,
  ActivityTagObject,
  ActivityUrlObject
} from './common-objects'

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
  published: Date
  updated: Date
  mediaType: 'text/markdown'
  content: string
  icon: ActivityIconObject
  url: ActivityUrlObject[]
  actor?: string
}
