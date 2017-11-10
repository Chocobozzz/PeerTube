import * as validator from 'validator'
import {
  isVideoChannelCreateActivityValid,
  isVideoTorrentAddActivityValid,
  isVideoTorrentUpdateActivityValid,
  isVideoChannelUpdateActivityValid
} from './videos'

function isRootActivityValid (activity: any) {
  return Array.isArray(activity['@context']) &&
    (
      (activity.type === 'Collection' || activity.type === 'OrderedCollection') &&
      validator.isInt(activity.totalItems, { min: 0 }) &&
      Array.isArray(activity.items)
    ) ||
    (
      validator.isURL(activity.id) &&
      validator.isURL(activity.actor)
    )
}

function isActivityValid (activity: any) {
  return isVideoTorrentAddActivityValid(activity) ||
    isVideoChannelCreateActivityValid(activity) ||
    isVideoTorrentUpdateActivityValid(activity) ||
    isVideoChannelUpdateActivityValid(activity)
}

// ---------------------------------------------------------------------------

export {
  isRootActivityValid,
  isActivityValid
}
