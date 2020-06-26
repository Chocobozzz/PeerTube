import { Account, AccountSummary } from '../actors'
import { VideoChannel, VideoChannelSummary } from './channel/video-channel.model'
import { VideoConstant } from './video-constant.model'
import { VideoFile } from './video-file.model'
import { VideoPrivacy } from './video-privacy.enum'
import { VideoScheduleUpdate } from './video-schedule-update.model'
import { VideoState } from './video-state.enum'
import { VideoStreamingPlaylist } from './video-streaming-playlist.model'

export interface Video {
  id: number
  uuid: string
  createdAt: Date | string
  updatedAt: Date | string
  publishedAt: Date | string
  originallyPublishedAt: Date | string
  category: VideoConstant<number>
  licence: VideoConstant<number>
  language: VideoConstant<string>
  privacy: VideoConstant<VideoPrivacy>
  description: string
  duration: number
  isLocal: boolean
  name: string

  thumbnailPath: string
  thumbnailUrl?: string

  previewPath: string
  previewUrl?: string

  embedPath: string
  embedUrl?: string

  // When using the search index
  url?: string

  views: number
  likes: number
  dislikes: number
  nsfw: boolean

  waitTranscoding?: boolean
  state?: VideoConstant<VideoState>
  scheduledUpdate?: VideoScheduleUpdate

  blacklisted?: boolean
  blacklistedReason?: string

  account: AccountSummary
  channel: VideoChannelSummary

  userHistory?: {
    currentTime: number
  }
}

export interface VideoDetails extends Video {
  descriptionPath: string
  support: string
  channel: VideoChannel
  account: Account
  tags: string[]
  files: VideoFile[]
  commentsEnabled: boolean
  downloadEnabled: boolean

  // Not optional in details (unlike in Video)
  waitTranscoding: boolean
  state: VideoConstant<VideoState>

  trackerUrls: string[]

  streamingPlaylists: VideoStreamingPlaylist[]
}
