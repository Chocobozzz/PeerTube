import { VideoPlaylistPrivacy } from '../videos/playlist/video-playlist-privacy.model'

export interface PluginPlaylistPrivacyManager {
  // PUBLIC = 1,
  // UNLISTED = 2,
  // PRIVATE = 3
  deletePlaylistPrivacy: (privacyKey: VideoPlaylistPrivacy) => boolean
}
