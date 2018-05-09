import * as validator from 'validator'
import { Activity, ActivityType } from '../../../../shared/models/activitypub'
import {
  isActorAcceptActivityValid, isActorDeleteActivityValid, isActorFollowActivityValid, isActorRejectActivityValid,
  isActorUpdateActivityValid
} from './actor'
import { isAnnounceActivityValid } from './announce'
import { isActivityPubUrlValid } from './misc'
import { isDislikeActivityValid, isLikeActivityValid } from './rate'
import { isUndoActivityValid } from './undo'
import { isVideoCommentCreateActivityValid, isVideoCommentDeleteActivityValid } from './video-comments'
import {
  isVideoFlagValid,
  sanitizeAndCheckVideoTorrentCreateActivity,
  isVideoTorrentDeleteActivityValid,
  sanitizeAndCheckVideoTorrentUpdateActivity
} from './videos'
import { isViewActivityValid } from './view'

function isRootActivityValid (activity: any) {
  return Array.isArray(activity['@context']) &&
    (
      (activity.type === 'Collection' || activity.type === 'OrderedCollection') &&
      validator.isInt(activity.totalItems, { min: 0 }) &&
      Array.isArray(activity.items)
    ) ||
    (
      isActivityPubUrlValid(activity.id) &&
      (isActivityPubUrlValid(activity.actor) || isActivityPubUrlValid(activity.actor.id))
    )
}

const activityCheckers: { [ P in ActivityType ]: (activity: Activity) => boolean } = {
  Create: checkCreateActivity,
  Update: checkUpdateActivity,
  Delete: checkDeleteActivity,
  Follow: checkFollowActivity,
  Accept: checkAcceptActivity,
  Reject: checkRejectActivity,
  Announce: checkAnnounceActivity,
  Undo: checkUndoActivity,
  Like: checkLikeActivity
}

function isActivityValid (activity: any) {
  const checker = activityCheckers[activity.type]
  // Unknown activity type
  if (!checker) return false

  return checker(activity)
}

// ---------------------------------------------------------------------------

export {
  isRootActivityValid,
  isActivityValid
}

// ---------------------------------------------------------------------------

function checkCreateActivity (activity: any) {
  return isViewActivityValid(activity) ||
    isDislikeActivityValid(activity) ||
    sanitizeAndCheckVideoTorrentCreateActivity(activity) ||
    isVideoFlagValid(activity) ||
    isVideoCommentCreateActivityValid(activity)
}

function checkUpdateActivity (activity: any) {
  return sanitizeAndCheckVideoTorrentUpdateActivity(activity) ||
    isActorUpdateActivityValid(activity)
}

function checkDeleteActivity (activity: any) {
  return isVideoTorrentDeleteActivityValid(activity) ||
    isActorDeleteActivityValid(activity) ||
    isVideoCommentDeleteActivityValid(activity)
}

function checkFollowActivity (activity: any) {
  return isActorFollowActivityValid(activity)
}

function checkAcceptActivity (activity: any) {
  return isActorAcceptActivityValid(activity)
}

function checkRejectActivity (activity: any) {
  return isActorRejectActivityValid(activity)
}

function checkAnnounceActivity (activity: any) {
  return isAnnounceActivityValid(activity)
}

function checkUndoActivity (activity: any) {
  return isUndoActivityValid(activity)
}

function checkLikeActivity (activity: any) {
  return isLikeActivityValid(activity)
}
