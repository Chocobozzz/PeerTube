import validator from 'validator'
import { Activity, ActivityType } from '../../../../shared/models/activitypub'
import { sanitizeAndCheckActorObject } from './actor'
import { isActivityPubUrlValid, isBaseActivityValid, isObjectValid } from './misc'
import { isDislikeActivityValid } from './rate'
import { sanitizeAndCheckVideoCommentObject } from './video-comments'
import { sanitizeAndCheckVideoTorrentObject } from './videos'
import { isViewActivityValid } from './view'
import { exists } from '../misc'
import { isCacheFileObjectValid } from './cache-file'
import { isFlagActivityValid } from './flag'
import { isPlaylistObjectValid } from './playlist'

function isRootActivityValid (activity: any) {
  return isCollection(activity) || isActivity(activity)
}

function isCollection (activity: any) {
  return (activity.type === 'Collection' || activity.type === 'OrderedCollection') &&
    validator.isInt(activity.totalItems, { min: 0 }) &&
    Array.isArray(activity.items)
}

function isActivity (activity: any) {
  return isActivityPubUrlValid(activity.id) &&
    exists(activity.actor) &&
    (isActivityPubUrlValid(activity.actor) || isActivityPubUrlValid(activity.actor.id))
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
  Like: checkLikeActivity,
  View: checkViewActivity,
  Flag: checkFlagActivity,
  Dislike: checkDislikeActivity
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

function checkViewActivity (activity: any) {
  return isBaseActivityValid(activity, 'View') &&
    isViewActivityValid(activity)
}

function checkFlagActivity (activity: any) {
  return isBaseActivityValid(activity, 'Flag') &&
    isFlagActivityValid(activity)
}

function checkDislikeActivity (activity: any) {
  return isBaseActivityValid(activity, 'Dislike') &&
    isDislikeActivityValid(activity)
}

function checkCreateActivity (activity: any) {
  return isBaseActivityValid(activity, 'Create') &&
    (
      isViewActivityValid(activity.object) ||
      isDislikeActivityValid(activity.object) ||
      isFlagActivityValid(activity.object) ||
      isPlaylistObjectValid(activity.object) ||

      isCacheFileObjectValid(activity.object) ||
      sanitizeAndCheckVideoCommentObject(activity.object) ||
      sanitizeAndCheckVideoTorrentObject(activity.object)
    )
}

function checkUpdateActivity (activity: any) {
  return isBaseActivityValid(activity, 'Update') &&
    (
      isCacheFileObjectValid(activity.object) ||
      isPlaylistObjectValid(activity.object) ||
      sanitizeAndCheckVideoTorrentObject(activity.object) ||
      sanitizeAndCheckActorObject(activity.object)
    )
}

function checkDeleteActivity (activity: any) {
  // We don't really check objects
  return isBaseActivityValid(activity, 'Delete') &&
    isObjectValid(activity.object)
}

function checkFollowActivity (activity: any) {
  return isBaseActivityValid(activity, 'Follow') &&
    isObjectValid(activity.object)
}

function checkAcceptActivity (activity: any) {
  return isBaseActivityValid(activity, 'Accept')
}

function checkRejectActivity (activity: any) {
  return isBaseActivityValid(activity, 'Reject')
}

function checkAnnounceActivity (activity: any) {
  return isBaseActivityValid(activity, 'Announce') &&
    isObjectValid(activity.object)
}

function checkUndoActivity (activity: any) {
  return isBaseActivityValid(activity, 'Undo') &&
    (
      checkFollowActivity(activity.object) ||
      checkLikeActivity(activity.object) ||
      checkDislikeActivity(activity.object) ||
      checkAnnounceActivity(activity.object) ||
      checkCreateActivity(activity.object)
    )
}

function checkLikeActivity (activity: any) {
  return isBaseActivityValid(activity, 'Like') &&
    isObjectValid(activity.object)
}
