import * as validator from 'validator'
import { isAccountAcceptActivityValid, isAccountDeleteActivityValid, isAccountFollowActivityValid } from './account'
import { isActivityPubUrlValid } from './misc'
import {
  isVideoAnnounceValid,
  isVideoChannelAnnounceValid,
  isVideoChannelCreateActivityValid,
  isVideoChannelDeleteActivityValid,
  isVideoChannelUpdateActivityValid,
  isVideoFlagValid,
  isVideoTorrentAddActivityValid,
  isVideoTorrentDeleteActivityValid,
  isVideoTorrentUpdateActivityValid
} from './videos'

function isRootActivityValid (activity: any) {
  return Array.isArray(activity['@context']) &&
    (
      (activity.type === 'Collection' || activity.type === 'OrderedCollection') &&
      validator.isInt(activity.totalItems, { min: 0 }) &&
      Array.isArray(activity.items)
    ) ||
    (
      isActivityPubUrlValid(activity.id) &&
      isActivityPubUrlValid(activity.actor)
    )
}

function isActivityValid (activity: any) {
  return isVideoTorrentAddActivityValid(activity) ||
    isVideoChannelCreateActivityValid(activity) ||
    isVideoTorrentUpdateActivityValid(activity) ||
    isVideoChannelUpdateActivityValid(activity) ||
    isVideoTorrentDeleteActivityValid(activity) ||
    isVideoChannelDeleteActivityValid(activity) ||
    isAccountDeleteActivityValid(activity) ||
    isAccountFollowActivityValid(activity) ||
    isAccountAcceptActivityValid(activity) ||
    isVideoFlagValid(activity) ||
    isVideoAnnounceValid(activity) ||
    isVideoChannelAnnounceValid(activity)
}

// ---------------------------------------------------------------------------

export {
  isRootActivityValid,
  isActivityValid
}
