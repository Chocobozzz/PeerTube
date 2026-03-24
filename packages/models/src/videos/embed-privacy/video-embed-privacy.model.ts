import { ConstantLabel } from '../../common/constant-label.model.js'
import { VideoEmbedPrivacyPolicyType } from './video-embed-privacy-policy.enum.js'

export interface VideoEmbedPrivacy {
  policy: ConstantLabel<VideoEmbedPrivacyPolicyType>

  domains: string[]
}
