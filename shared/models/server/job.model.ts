import { SendEmailOptions } from './emailer.model'
import { VideoResolution } from '@shared/models'
import { ContextType } from '../activitypub/context'

export type JobState = 'active' | 'completed' | 'failed' | 'waiting' | 'delayed'

export type JobType =
  | 'activitypub-http-unicast'
  | 'activitypub-http-broadcast'
  | 'activitypub-http-fetcher'
  | 'activitypub-follow'
  | 'video-file-import'
  | 'video-transcoding'
  | 'email'
  | 'video-import'
  | 'videos-views'
  | 'activitypub-refresher'
  | 'video-redundancy'

export interface Job {
  id: number
  state: JobState
  type: JobType
  data: any
  error: any
  createdAt: Date | string
  finishedOn: Date | string
  processedOn: Date | string
}

export type ActivitypubHttpBroadcastPayload = {
  uris: string[]
  signatureActorId?: number
  body: any
  contextType?: ContextType
}

export type ActivitypubFollowPayload = {
  followerActorId: number
  name: string
  host: string
  isAutoFollow?: boolean
  assertIsChannel?: boolean
}

export type FetchType = 'activity' | 'video-likes' | 'video-dislikes' | 'video-shares' | 'video-comments' | 'account-playlists'
export type ActivitypubHttpFetcherPayload = {
  uri: string
  type: FetchType
  videoId?: number
  accountId?: number
}

export type ActivitypubHttpUnicastPayload = {
  uri: string
  signatureActorId?: number
  body: any
  contextType?: ContextType
}

export type RefreshPayload = {
  type: 'video' | 'video-playlist' | 'actor'
  url: string
}

export type EmailPayload = SendEmailOptions

export type VideoFileImportPayload = {
  videoUUID: string
  filePath: string
}

export type VideoImportTorrentPayloadType = 'magnet-uri' | 'torrent-file'
export type VideoImportYoutubeDLPayloadType = 'youtube-dl'

export type VideoImportYoutubeDLPayload = {
  type: VideoImportYoutubeDLPayloadType
  videoImportId: number

  generateThumbnail: boolean
  generatePreview: boolean

  fileExt?: string
}
export type VideoImportTorrentPayload = {
  type: VideoImportTorrentPayloadType
  videoImportId: number
}
export type VideoImportPayload = VideoImportYoutubeDLPayload | VideoImportTorrentPayload

export type VideoRedundancyPayload = {
  videoId: number
}

// Video transcoding payloads

interface BaseTranscodingPayload {
  videoUUID: string
  isNewVideo?: boolean
}

interface HLSTranscodingPayload extends BaseTranscodingPayload {
  type: 'hls'
  isPortraitMode?: boolean
  resolution: VideoResolution
  copyCodecs: boolean
}

export interface NewResolutionTranscodingPayload extends BaseTranscodingPayload {
  type: 'new-resolution'
  isPortraitMode?: boolean
  resolution: VideoResolution
}

export interface MergeAudioTranscodingPayload extends BaseTranscodingPayload {
  type: 'merge-audio'
  resolution: VideoResolution
}

export interface OptimizeTranscodingPayload extends BaseTranscodingPayload {
  type: 'optimize'
}

export type VideoTranscodingPayload =
  HLSTranscodingPayload
  | NewResolutionTranscodingPayload
  | OptimizeTranscodingPayload
  | MergeAudioTranscodingPayload
