import { VideoEmbedPrivacyPolicy } from '@peertube/peertube-models'
import { VIDEO_EMBED_PRIVACY_POLICIES } from '@server/initializers/constants.js'
import { isArray } from './misc.js'
import { isHostValid } from './servers.js'

export function areVideoEmbedPrivacyDomainsValid (value: string[]) {
  if (!isArray(value)) return false
  if (!value.every(v => isHostValid(v))) return false

  return true
}

export function isVideoEmbedPrivacyPolicyValid (value: any) {
  return VIDEO_EMBED_PRIVACY_POLICIES[value] !== undefined && value !== VideoEmbedPrivacyPolicy.REMOTE_RESTRICTIONS
}
