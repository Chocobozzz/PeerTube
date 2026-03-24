import { VideoEmbedPrivacyPolicyType } from './video-embed-privacy-policy.enum.js'

export interface VideoEmbedPrivacyUpdate {
  policy: VideoEmbedPrivacyPolicyType

  domains: string[]
}
