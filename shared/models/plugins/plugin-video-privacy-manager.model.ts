import { VideoPrivacy } from '@shared/models'

export interface PluginVideoPrivacyManager {
  // PUBLIC = 1
  // UNLISTED = 2
  // PRIVATE = 3
  // INTERNAL = 4
  deletePrivacy: (privacyKey: VideoPrivacy) => boolean
}
