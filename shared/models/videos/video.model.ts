import { Account, AccountSummary } from '../actors'
import { VideoChannel, VideoChannelSummary } from './channel/video-channel.model'
import { VideoFile } from './file'
import { VideoConstant } from './video-constant.model'
import { VideoPrivacy } from './video-privacy.enum'
import { VideoScheduleUpdate } from './video-schedule-update.model'
import { VideoState } from './video-state.enum'
import { VideoStreamingPlaylist } from './video-streaming-playlist.model'

export interface Video extends Partial<VideoAdditionalAttributes> {
  id: number
  uuid: string
  shortUUID: string

  createdAt: Date | string
  updatedAt: Date | string
  publishedAt: Date | string
  originallyPublishedAt: Date | string
  category: VideoConstant<number>
  licence: VideoConstant<number>
  language: VideoConstant<string>
  privacy: VideoConstant<VideoPrivacy>

  // Deprecated in 5.0 in favour of truncatedDescription
  description: string
  truncatedDescription: string

  duration: number
  isLocal: boolean
  name: string

  isLive: boolean

  thumbnailPath: string
  thumbnailUrl?: string

  previewPath: string
  previewUrl?: string

  embedPath: string
  embedUrl?: string

  url: string

  views: number
  viewers: number

  likes: number
  dislikes: number
  nsfw: boolean

  account: AccountSummary
  channel: VideoChannelSummary

  userHistory?: {
    currentTime: number
  }

  pluginData?: any
}

// Not included by default, needs query params
export interface VideoAdditionalAttributes {
  waitTranscoding: boolean
  state: VideoConstant<VideoState>
  scheduledUpdate: VideoScheduleUpdate

  blacklisted: boolean
  blacklistedReason: string

  blockedOwner: boolean
  blockedServer: boolean

  files: VideoFile[]
  streamingPlaylists: VideoStreamingPlaylist[]
}

export interface VideoDetails extends Video {
  // Deprecated in 5.0
  descriptionPath: string

  support: string
  channel: VideoChannel
  account: Account
  tags: string[]
  commentsEnabled: boolean
  downloadEnabled: boolean

  // Not optional in details (unlike in parent Video)
  waitTranscoding: boolean
  state: VideoConstant<VideoState>

  trackerUrls: string[]

  files: VideoFile[]
  streamingPlaylists: VideoStreamingPlaylist[]
}
