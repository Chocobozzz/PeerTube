import { VideoStreamingPlaylistType } from './video-streaming-playlist.type'
import { VideoFile } from './video-file.model'

export interface VideoStreamingPlaylist {
  id: number
  type: VideoStreamingPlaylistType
  playlistUrl: string
  segmentsSha256Url: string

  redundancies: {
    baseUrl: string
  }[]

  files: VideoFile[]
}
