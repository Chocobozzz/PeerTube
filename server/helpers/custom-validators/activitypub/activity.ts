import validator from 'validator'
import { Activity, ActivityType } from '../../../../shared/models/activitypub'
import { isAbuseReasonValid } from '../abuses'
import { exists } from '../misc'
import { sanitizeAndCheckActorObject } from './actor'
import { isCacheFileObjectValid } from './cache-file'
import { isActivityPubUrlValid, isBaseActivityValid, isObjectValid } from './misc'
import { isPlaylistObjectValid } from './playlist'
import { sanitizeAndCheckVideoCommentObject } from './video-comments'
import { sanitizeAndCheckVideoTorrentObject } from './videos'

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
  Create: isCreateActivityValid,
  Update: isUpdateActivityValid,
  Delete: isDeleteActivityValid,
  Follow: isFollowActivityValid,
  Accept: isAcceptActivityValid,
  Reject: isRejectActivityValid,
  Announce: isAnnounceActivityValid,
  Undo: isUndoActivityValid,
  Like: isLikeActivityValid,
  View: isViewActivityValid,
  Flag: isFlagActivityValid,
  Dislike: isDislikeActivityValid
}

function isActivityValid (activity: any) {
  const checker = activityCheckers[activity.type]
  // Unknown activity type
  if (!checker) return false

  return checker(activity)
}

function isFlagActivityValid (activity: any) {
  return isBaseActivityValid(activity, 'Flag') &&
    isAbuseReasonValid(activity.content) &&
    isActivityPubUrlValid(activity.object)
}

function isLikeActivityValid (activity: any) {
  return isBaseActivityValid(activity, 'Like') &&
    isObjectValid(activity.object)
}

function isDislikeActivityValid (activity: any) {
  return isBaseActivityValid(activity, 'Dislike') &&
    isObjectValid(activity.object)
}

function isAnnounceActivityValid (activity: any) {
  return isBaseActivityValid(activity, 'Announce') &&
    isObjectValid(activity.object)
}

function isViewActivityValid (activity: any) {
  return isBaseActivityValid(activity, 'View') &&
    isActivityPubUrlValid(activity.actor) &&
    isActivityPubUrlValid(activity.object)
}

function isCreateActivityValid (activity: any) {
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

function isUpdateActivityValid (activity: any) {
  return isBaseActivityValid(activity, 'Update') &&
    (
      isCacheFileObjectValid(activity.object) ||
      isPlaylistObjectValid(activity.object) ||
      sanitizeAndCheckVideoTorrentObject(activity.object) ||
      sanitizeAndCheckActorObject(activity.object)
    )
}

function isDeleteActivityValid (activity: any) {
  // We don't really check objects
  return isBaseActivityValid(activity, 'Delete') &&
    isObjectValid(activity.object)
}

function isFollowActivityValid (activity: any) {
  return isBaseActivityValid(activity, 'Follow') &&
    isObjectValid(activity.object)
}

function isAcceptActivityValid (activity: any) {
  return isBaseActivityValid(activity, 'Accept')
}

function isRejectActivityValid (activity: any) {
  return isBaseActivityValid(activity, 'Reject')
}

function isUndoActivityValid (activity: any) {
  return isBaseActivityValid(activity, 'Undo') &&
    (
      isFollowActivityValid(activity.object) ||
      isLikeActivityValid(activity.object) ||
      isDislikeActivityValid(activity.object) ||
      isAnnounceActivityValid(activity.object) ||
      isCreateActivityValid(activity.object)
    )
}

// ---------------------------------------------------------------------------

export {
  isRootActivityValid,
  isActivityValid,
  isFlagActivityValid,
  isLikeActivityValid,
  isDislikeActivityValid,
  isAnnounceActivityValid,
  isViewActivityValid,
  isCreateActivityValid,
  isUpdateActivityValid,
  isDeleteActivityValid,
  isFollowActivityValid,
  isAcceptActivityValid,
  isRejectActivityValid,
  isUndoActivityValid
}
