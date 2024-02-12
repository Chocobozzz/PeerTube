import { VideoPlaylistPrivacyType } from '../../videos/playlist/video-playlist-privacy.model.js'
import { VideoPlaylistType_Type } from '../../videos/playlist/video-playlist-type.model.js'

export interface VideoPlaylistsExportJSON {
  videoPlaylists: {
    displayName: string
    description: string
    privacy: VideoPlaylistPrivacyType
    url: string
    uuid: string

    type: VideoPlaylistType_Type

    channel: {
      name: string
    }

    createdAt: string
    updatedAt: string

    thumbnailUrl: string

    elements: {
      videoUrl: string

      startTimestamp?: number
      stopTimestamp?: number
    }[]

    archiveFiles: {
      thumbnail: string | null
    }
  }[]
}
