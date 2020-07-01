import { isActivityPubUrlValid } from './misc'
import { isAbuseReasonValid } from '../abuses'

function isFlagActivityValid (activity: any) {
  return activity.type === 'Flag' &&
    isAbuseReasonValid(activity.content) &&
    isActivityPubUrlValid(activity.object)
}

// ---------------------------------------------------------------------------

export {
  isFlagActivityValid
}
