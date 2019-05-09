import { VideoStreamingPlaylistType } from './video-streaming-playlist.type'

export class VideoStreamingPlaylist {
  id: number
  type: VideoStreamingPlaylistType
  playlistUrl: string
  segmentsSha256Url: string

  redundancies: {
    baseUrl: string
  }[]
}
