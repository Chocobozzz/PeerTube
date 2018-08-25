import { VideoResolution, VideoState } from '../../index'
import { Account } from '../actors'
import { Avatar } from '../avatars/avatar.model'
import { VideoChannel } from './channel/video-channel.model'
import { VideoPrivacy } from './video-privacy.enum'
import { VideoScheduleUpdate } from './video-schedule-update.model'
import { VideoConstant } from './video-constant.model'

export interface VideoFile {
  magnetUri: string
  resolution: VideoConstant<VideoResolution>
  size: number // Bytes
  torrentUrl: string
  torrentDownloadUrl: string
  fileUrl: string
  fileDownloadUrl: string
  fps: number
}

export interface Video {
  id: number
  uuid: string
  createdAt: Date | string
  updatedAt: Date | string
  publishedAt: Date | string
  category: VideoConstant<number>
  licence: VideoConstant<number>
  language: VideoConstant<string>
  privacy: VideoConstant<VideoPrivacy>
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

  waitTranscoding?: boolean
  state?: VideoConstant<VideoState>
  scheduledUpdate?: VideoScheduleUpdate

  blacklisted?: boolean
  blacklistedReason?: string

  account: {
    id: number
    uuid: string
    name: string
    displayName: string
    url: string
    host: string
    avatar: Avatar
  }

  channel: {
    id: number
    uuid: string
    name: string
    displayName: string
    url: string
    host: string
    avatar: Avatar
  }
}

export interface VideoDetails extends Video {
  descriptionPath: string
  support: string
  channel: VideoChannel
  tags: string[]
  files: VideoFile[]
  account: Account
  commentsEnabled: boolean

  // Not optional in details (unlike in Video)
  waitTranscoding: boolean
  state: VideoConstant<VideoState>
}
