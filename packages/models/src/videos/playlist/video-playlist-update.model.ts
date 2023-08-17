import { VideoPlaylistPrivacyType } from './video-playlist-privacy.model.js'

export interface VideoPlaylistUpdate {
  displayName?: string
  privacy?: VideoPlaylistPrivacyType

  description?: string
  videoChannelId?: number
  thumbnailfile?: any
}
