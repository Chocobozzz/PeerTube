import { LiveVideoLatencyModeType, VideoCommentPolicyType, VideoStateType } from '../../videos/index.js'
import {
  ActivityIconObject,
  ActivityIdentifierObject,
  ActivityPubAttributedTo,
  ActivityTagObject,
  ActivityUrlObject
} from './common-objects.js'
import { VideoChapterObject } from './video-chapters-object.js'

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
  latencyMode: LiveVideoLatencyModeType

  commentsEnabled?: boolean
  commentsPolicy: VideoCommentPolicyType
  canReply: 'as:Public' | 'https://www.w3.org/ns/activitystreams#Public'

  downloadEnabled: boolean
  waitTranscoding: boolean
  state: VideoStateType

  published: string
  originallyPublishedAt: string
  updated: string
  uploadDate: string

  mediaType: 'text/markdown'
  content: string

  support: string

  aspectRatio: number

  icon: ActivityIconObject[]

  url: ActivityUrlObject[]

  likes: string
  dislikes: string
  shares: string
  comments: string
  hasParts: string | VideoChapterObject[]

  attributedTo: ActivityPubAttributedTo[]

  preview?: ActivityPubStoryboard[]

  to?: string[]
  cc?: string[]

  // For export
  attachment?: {
    type: 'Video'
    url: string
    mediaType: string
    height: number
    size: number
    fps: number
  }[]
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
