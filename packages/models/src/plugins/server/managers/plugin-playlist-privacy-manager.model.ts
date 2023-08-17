import { VideoPlaylistPrivacyType } from '../../../videos/playlist/video-playlist-privacy.model.js'
import { ConstantManager } from '../plugin-constant-manager.model.js'

export interface PluginPlaylistPrivacyManager extends ConstantManager<VideoPlaylistPrivacyType> {
  /**
   * PUBLIC = 1,
   * UNLISTED = 2,
   * PRIVATE = 3
   * @deprecated use `deleteConstant` instead
   */
  deletePlaylistPrivacy: (privacyKey: VideoPlaylistPrivacyType) => boolean
}
