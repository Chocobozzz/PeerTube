import { VideoPlaylistPrivacy } from '../../../videos/playlist/video-playlist-privacy.model'
import { ConstantManager } from '../plugin-constant-manager.model'

export interface PluginPlaylistPrivacyManager extends ConstantManager<VideoPlaylistPrivacy> {
  /**
   * PUBLIC = 1,
   * UNLISTED = 2,
   * PRIVATE = 3
   * @deprecated use `deleteConstant` instead
   */
  deletePlaylistPrivacy: (privacyKey: VideoPlaylistPrivacy) => boolean
}
