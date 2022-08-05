import { VideoPrivacy } from '../../../videos/video-privacy.enum'
import { ConstantManager } from '../plugin-constant-manager.model'

export interface PluginVideoPrivacyManager extends ConstantManager<VideoPrivacy> {
  /**
   * PUBLIC = 1,
   * UNLISTED = 2,
   * PRIVATE = 3
   * INTERNAL = 4
   * @deprecated use `deleteConstant` instead
   */
  deletePrivacy: (privacyKey: VideoPrivacy) => boolean
}
