import { VideoPlaylistPrivacy } from './video-playlist-privacy.model'

export interface VideoPlaylistCreate {
  displayName: string
  privacy: VideoPlaylistPrivacy

  description?: string
  videoChannelId?: number

  thumbnailfile?: any
}
