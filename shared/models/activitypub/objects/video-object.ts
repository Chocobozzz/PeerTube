import {
  ActivityIconObject,
  ActivityIdentifierObject,
  ActivityPubAttributedTo,
  ActivityTagObject,
  ActivityUrlObject
} from './common-objects'
import { LiveVideoLatencyMode, VideoState } from '../../videos'

export interface VideoObject {
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

  isLiveBroadcast: boolean
  liveSaveReplay: boolean
  permanentLive: boolean
  latencyMode: LiveVideoLatencyMode

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

  preview?: ActivityPubStoryboard[]

  to?: string[]
  cc?: string[]
}

export interface ActivityPubStoryboard {
  type: 'Image'
  rel: [ 'storyboard' ]
  url: {
    href: string
    mediaType: string
    width: number
    height: number
    tileWidth: number
    tileHeight: number
    tileDuration: string
  }[]
}
