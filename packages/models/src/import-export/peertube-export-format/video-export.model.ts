import {
  LiveVideoLatencyModeType,
  VideoCommentPolicyType,
  VideoFileMetadata,
  VideoPrivacyType,
  VideoStateType,
  VideoStreamingPlaylistType_Type
} from '../../videos/index.js'

export interface VideoExportJSON {
  videos: {
    uuid: string

    createdAt: string
    updatedAt: string
    publishedAt: string
    originallyPublishedAt: string

    name: string
    category: number
    licence: number
    language: string
    tags: string[]

    privacy: VideoPrivacyType
    passwords: string[]

    duration: number

    description: string
    support: string

    isLive: boolean
    live?: {
      saveReplay: boolean
      permanentLive: boolean
      latencyMode: LiveVideoLatencyModeType
      streamKey: string

      replaySettings?: {
        privacy: VideoPrivacyType
      }
    }

    url: string

    thumbnailUrl: string
    previewUrl: string

    views: number

    likes: number
    dislikes: number

    nsfw: boolean

    // TODO: remove, deprecated in 6.2
    commentsEnabled?: boolean
    commentsPolicy: VideoCommentPolicyType

    downloadEnabled: boolean

    channel: {
      name: string
    }

    waitTranscoding: boolean
    state: VideoStateType

    captions: {
      createdAt: string
      updatedAt: string
      language: string
      filename: string
      fileUrl: string
    }[]

    chapters: {
      timecode: number
      title: string
    }[]

    files: VideoFileExportJSON[]

    streamingPlaylists: {
      type: VideoStreamingPlaylistType_Type
      playlistUrl: string
      segmentsSha256Url: string
      files: VideoFileExportJSON[]
    }[]

    source?: {
      inputFilename: string

      resolution: number
      size: number

      width: number
      height: number

      fps: number

      metadata: VideoFileMetadata
    }

    archiveFiles: {
      videoFile: string | null
      thumbnail: string | null
      captions: Record<string, string> // The key is the language code
    }
  }[]
}

// ---------------------------------------------------------------------------

export interface VideoFileExportJSON {
  resolution: number
  size: number // Bytes
  fps: number

  torrentUrl: string
  fileUrl: string
}
