import { VideoPrivacyType } from '../../../videos/video-privacy.enum.js'
import { ConstantManager } from '../plugin-constant-manager.model.js'

export interface PluginVideoPrivacyManager extends ConstantManager<VideoPrivacyType> {
  /**
   * PUBLIC = 1,
   * UNLISTED = 2,
   * PRIVATE = 3
   * INTERNAL = 4
   * @deprecated use `deleteConstant` instead
   */
  deletePrivacy: (privacyKey: VideoPrivacyType) => boolean
}
