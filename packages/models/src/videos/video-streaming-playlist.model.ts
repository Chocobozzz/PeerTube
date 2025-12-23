import { VideoFile } from './file/index.js'
import { VideoStreamingPlaylistType_Type } from './video-streaming-playlist.type.js'

export interface VideoStreamingPlaylist {
  id: number
  type: VideoStreamingPlaylistType_Type
  playlistUrl: string
  segmentsSha256Url: string

  redundancies: {
    baseUrl: string
  }[]

  files: (VideoFile & { playlistUrl: string })[]
}
