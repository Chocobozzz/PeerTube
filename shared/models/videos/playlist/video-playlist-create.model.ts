import { VideoPlaylistPrivacy } from './video-playlist-privacy.model'

export interface VideoPlaylistCreate {
  displayName: string
  description: string
  privacy: VideoPlaylistPrivacy

  videoChannelId?: number

  thumbnailfile?: Blob
}
