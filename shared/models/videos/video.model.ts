import { AccountSummary, VideoChannelSummary, VideoResolution, VideoState } from '../../index'
import { Account } from '../actors'
import { VideoChannel } from './channel/video-channel.model'
import { VideoPrivacy } from './video-privacy.enum'
import { VideoScheduleUpdate } from './video-schedule-update.model'
import { VideoConstant } from './video-constant.model'
import { VideoStreamingPlaylist } from './video-streaming-playlist.model'
import { VideoFile } from './video-file.model'

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
