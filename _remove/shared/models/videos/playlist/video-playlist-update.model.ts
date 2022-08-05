import { VideoPlaylistPrivacy } from './video-playlist-privacy.model'

export interface VideoPlaylistUpdate {
  displayName?: string
  privacy?: VideoPlaylistPrivacy

  description?: string
  videoChannelId?: number
  thumbnailfile?: any
}
