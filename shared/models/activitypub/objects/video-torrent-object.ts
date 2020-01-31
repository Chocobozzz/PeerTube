import {
  ActivityIconObject,
  ActivityIdentifierObject,
  ActivityPubAttributedTo,
  ActivityTagObject,
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
  category: ActivityIdentifierObject
  licence: ActivityIdentifierObject
  language: ActivityIdentifierObject
  subtitleLanguage: ActivityIdentifierObject[]
  views: number
  sensitive: boolean
  commentsEnabled: boolean
  downloadEnabled: boolean
  waitTranscoding: boolean
  state: VideoState
  published: string
  originallyPublishedAt: string
  updated: string
  mediaType: 'text/markdown'
  content: string
  support: string

  icon: ActivityIconObject[]

  url: ActivityUrlObject[]
  likes: string
  dislikes: string
  shares: string
  comments: string
  attributedTo: ActivityPubAttributedTo[]
  to?: string[]
  cc?: string[]
}
