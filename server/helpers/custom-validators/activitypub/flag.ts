import { isActivityPubUrlValid } from './misc'
import { isVideoAbuseReasonValid } from '../video-abuses'

function isFlagActivityValid (activity: any) {
  return activity.type === 'Flag' &&
    isVideoAbuseReasonValid(activity.content) &&
    isActivityPubUrlValid(activity.object)
}

// ---------------------------------------------------------------------------

export {
  isFlagActivityValid
}
