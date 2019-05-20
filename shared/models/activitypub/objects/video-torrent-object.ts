import {
  ActivityIconObject,
  ActivityIdentifierObject,
  ActivityPubAttributedTo,
  ActivityTagObject,
  ActivityAutorObject,
  ActivityUrlObject
} from './common-objects'
import { VideoState } from '../../videos'

export interface VideoTorrentObject {
  type: 'Video'
  id: string
  name: string
  duration: string
  uuid: string
  tag: ActivityTagObject[]
  autor: ActivityAutorObject[]
  category: ActivityIdentifierObject
  licence: ActivityIdentifierObject
  language: ActivityIdentifierObject
  subtitleLanguage: ActivityIdentifierObject[]
  views: number
  sensitive: boolean
  commentsEnabled: boolean
  waitTranscoding: boolean
  state: VideoState
  published: string
  updated: string
  mediaType: 'text/markdown'
  content: string
  support: string
  icon: ActivityIconObject
  url: ActivityUrlObject[]
  likes: string
  dislikes: string
  articleid: number
  shares: string
  comments: string
  attributedTo: ActivityPubAttributedTo[]
  to?: string[]
  cc?: string[]
}
