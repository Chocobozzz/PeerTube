import { ContextType } from '../activitypub/context'
import { VideoState } from '../videos'
import { VideoResolution } from '../videos/file/video-resolution.enum'
import { VideoStudioTaskCut } from '../videos/studio'
import { SendEmailOptions } from './emailer.model'

export type JobState = 'active' | 'completed' | 'failed' | 'waiting' | 'delayed' | 'paused' | 'waiting-children'

export type JobType =
  | 'activitypub-cleaner'
  | 'activitypub-follow'
  | 'activitypub-http-broadcast-parallel'
  | 'activitypub-http-broadcast'
  | 'activitypub-http-fetcher'
  | 'activitypub-http-unicast'
  | 'activitypub-refresher'
  | 'actor-keys'
  | 'after-video-channel-import'
  | 'email'
  | 'federate-video'
  | 'transcoding-job-builder'
  | 'manage-video-torrent'
  | 'move-to-object-storage'
  | 'notify'
  | 'video-channel-import'
  | 'video-file-import'
  | 'video-import'
  | 'video-live-ending'
  | 'video-redundancy'
  | 'video-studio-edition'
  | 'video-transcoding'
  | 'videos-views-stats'
  | 'generate-video-storyboard'

export interface Job {
  id: number | string
  state: JobState | 'unknown'
  type: JobType
  data: any
  priority: number
  progress: number
  error: any
  createdAt: Date | string
  finishedOn: Date | string
  processedOn: Date | string

  parent?: {
    id: string
  }
}

export type ActivitypubHttpBroadcastPayload = {
  uris: string[]
  contextType: ContextType
  body: any
  signatureActorId?: number
}

export type ActivitypubFollowPayload = {
  followerActorId: number
  name: string
  host: string
  isAutoFollow?: boolean
  assertIsChannel?: boolean
}

export type FetchType = 'activity' | 'video-shares' | 'video-comments' | 'account-playlists'
export type ActivitypubHttpFetcherPayload = {
  uri: string
  type: FetchType
  videoId?: number
}

export type ActivitypubHttpUnicastPayload = {
  uri: string
  contextType: ContextType
  signatureActorId?: number
  body: object
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

// ---------------------------------------------------------------------------

export type VideoImportTorrentPayloadType = 'magnet-uri' | 'torrent-file'
export type VideoImportYoutubeDLPayloadType = 'youtube-dl'

export interface VideoImportYoutubeDLPayload {
  type: VideoImportYoutubeDLPayloadType
  videoImportId: number

  fileExt?: string
}

export interface VideoImportTorrentPayload {
  type: VideoImportTorrentPayloadType
  videoImportId: number
}

export type VideoImportPayload = (VideoImportYoutubeDLPayload | VideoImportTorrentPayload) & {
  preventException: boolean
}

export interface VideoImportPreventExceptionResult {
  resultType: 'success' | 'error'
}

// ---------------------------------------------------------------------------

export type VideoRedundancyPayload = {
  videoId: number
}

export type ManageVideoTorrentPayload =
  {
    action: 'create'
    videoId: number
    videoFileId: number
  } | {
    action: 'update-metadata'

    videoId?: number
    streamingPlaylistId?: number

    videoFileId: number
  }

// Video transcoding payloads

interface BaseTranscodingPayload {
  videoUUID: string
  isNewVideo?: boolean
}

export interface HLSTranscodingPayload extends BaseTranscodingPayload {
  type: 'new-resolution-to-hls'
  resolution: VideoResolution
  fps: number
  copyCodecs: boolean

  deleteWebTorrentFiles: boolean
}

export interface NewWebTorrentResolutionTranscodingPayload extends BaseTranscodingPayload {
  type: 'new-resolution-to-webtorrent'
  resolution: VideoResolution
  fps: number
}

export interface MergeAudioTranscodingPayload extends BaseTranscodingPayload {
  type: 'merge-audio-to-webtorrent'

  resolution: VideoResolution
  fps: number

  hasChildren: boolean
}

export interface OptimizeTranscodingPayload extends BaseTranscodingPayload {
  type: 'optimize-to-webtorrent'

  quickTranscode: boolean

  hasChildren: boolean
}

export type VideoTranscodingPayload =
  HLSTranscodingPayload
  | NewWebTorrentResolutionTranscodingPayload
  | OptimizeTranscodingPayload
  | MergeAudioTranscodingPayload

export interface VideoLiveEndingPayload {
  videoId: number
  publishedAt: string
  liveSessionId: number
  streamingPlaylistId: number

  replayDirectory?: string
}

export interface ActorKeysPayload {
  actorId: number
}

export interface DeleteResumableUploadMetaFilePayload {
  filepath: string
}

export interface MoveObjectStoragePayload {
  videoUUID: string
  isNewVideo: boolean
  previousVideoState: VideoState
}

export type VideoStudioTaskCutPayload = VideoStudioTaskCut

export type VideoStudioTaskIntroPayload = {
  name: 'add-intro'

  options: {
    file: string
  }
}

export type VideoStudioTaskOutroPayload = {
  name: 'add-outro'

  options: {
    file: string
  }
}

export type VideoStudioTaskWatermarkPayload = {
  name: 'add-watermark'

  options: {
    file: string

    watermarkSizeRatio: number
    horitonzalMarginRatio: number
    verticalMarginRatio: number
  }
}

export type VideoStudioTaskPayload =
  VideoStudioTaskCutPayload |
  VideoStudioTaskIntroPayload |
  VideoStudioTaskOutroPayload |
  VideoStudioTaskWatermarkPayload

export interface VideoStudioEditionPayload {
  videoUUID: string
  tasks: VideoStudioTaskPayload[]
}

// ---------------------------------------------------------------------------

export interface VideoChannelImportPayload {
  externalChannelUrl: string
  videoChannelId: number

  partOfChannelSyncId?: number
}

export interface AfterVideoChannelImportPayload {
  channelSyncId: number
}

// ---------------------------------------------------------------------------

export type NotifyPayload =
  {
    action: 'new-video'
    videoUUID: string
  }

// ---------------------------------------------------------------------------

export interface FederateVideoPayload {
  videoUUID: string
  isNewVideo: boolean
}

// ---------------------------------------------------------------------------

export interface TranscodingJobBuilderPayload {
  videoUUID: string

  optimizeJob?: {
    isNewVideo: boolean
  }

  // Array of jobs to create
  jobs?: {
    type: 'video-transcoding'
    payload: VideoTranscodingPayload
    priority?: number
  }[]

  // Array of sequential jobs to create
  sequentialJobs?: {
    type: 'video-transcoding'
    payload: VideoTranscodingPayload
    priority?: number
  }[][]
}

// ---------------------------------------------------------------------------

export interface GenerateStoryboardPayload {
  videoUUID: string
  federate: boolean
}
