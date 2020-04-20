import { VideoPlaylistPrivacy } from '@shared/models'

export interface PluginPlaylistPrivacyManager {
  // PUBLIC = 1,
  // UNLISTED = 2,
  // PRIVATE = 3
  deletePlaylistPrivacy: (privacyKey: VideoPlaylistPrivacy) => boolean
}
