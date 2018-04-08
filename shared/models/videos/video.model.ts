import { VideoResolution } from '../../index'
import { Account } from '../actors'
import { Avatar } from '../avatars/avatar.model'
import { VideoChannel } from './video-channel.model'
import { VideoPrivacy } from './video-privacy.enum'

export interface VideoConstant <T> {
  id: number
  label: string
}

export interface VideoFile {
  magnetUri: string
  resolution: VideoConstant<VideoResolution>
  size: number // Bytes
  torrentUrl: string
  fileUrl: string
}

export interface Video {
  id: number
  uuid: string
  createdAt: Date | string
  updatedAt: Date | string
  publishedAt: Date | string
  category: VideoConstant<number>
  licence: VideoConstant<number>
  language: VideoConstant<number>
  description: string
  duration: number
  isLocal: boolean
  name: string
  thumbnailPath: string
  previewPath: string
  embedPath: string
  views: number
  likes: number
  dislikes: number
  nsfw: boolean

  account: {
    name: string
    displayName: string
    url: string
    host: string
    avatar: Avatar
  }
}

export interface VideoDetails extends Video {
  privacy: VideoConstant<VideoPrivacy>
  descriptionPath: string
  support: string
  channel: VideoChannel
  tags: string[]
  files: VideoFile[]
  account: Account
  commentsEnabled: boolean
}
