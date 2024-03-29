import validator from 'validator'
import { Activity, ActivityType } from '@peertube/peertube-models'
import { isAbuseReasonValid } from '../abuses.js'
import { exists } from '../misc.js'
import { sanitizeAndCheckActorObject } from './actor.js'
import { isCacheFileObjectValid } from './cache-file.js'
import { isActivityPubUrlValid, isBaseActivityValid, isObjectValid } from './misc.js'
import { isPlaylistObjectValid } from './playlist.js'
import { sanitizeAndCheckVideoCommentObject } from './video-comments.js'
import { sanitizeAndCheckVideoTorrentObject } from './videos.js'
import { isWatchActionObjectValid } from './watch-action.js'

export function isRootActivityValid (activity: any) {
  return isCollection(activity) || isActivity(activity)
}

function isCollection (activity: any) {
  return (activity.type === 'Collection' || activity.type === 'OrderedCollection') &&
    validator.default.isInt(activity.totalItems, { min: 0 }) &&
    Array.isArray(activity.items)
}

function isActivity (activity: any) {
  return isActivityPubUrlValid(activity.id) &&
    exists(activity.actor) &&
    (isActivityPubUrlValid(activity.actor) || isActivityPubUrlValid(activity.actor.id))
}

// ---------------------------------------------------------------------------

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
  Dislike: isDislikeActivityValid,
  ApproveReply: isApproveReplyActivityValid,
  RejectReply: isRejectReplyActivityValid
}

export function isActivityValid (activity: any) {
  const checker = activityCheckers[activity.type]
  // Unknown activity type
  if (!checker) return false

  return checker(activity)
}

export function isFlagActivityValid (activity: any) {
  return isBaseActivityValid(activity, 'Flag') &&
    isAbuseReasonValid(activity.content) &&
    isActivityPubUrlValid(activity.object)
}

export function isLikeActivityValid (activity: any) {
  return isBaseActivityValid(activity, 'Like') &&
    isObjectValid(activity.object)
}

export function isDislikeActivityValid (activity: any) {
  return isBaseActivityValid(activity, 'Dislike') &&
    isObjectValid(activity.object)
}

export function isAnnounceActivityValid (activity: any) {
  return isBaseActivityValid(activity, 'Announce') &&
    isObjectValid(activity.object)
}

export function isViewActivityValid (activity: any) {
  return isBaseActivityValid(activity, 'View') &&
    isActivityPubUrlValid(activity.actor) &&
    isActivityPubUrlValid(activity.object)
}

export function isCreateActivityValid (activity: any) {
  return isBaseActivityValid(activity, 'Create') &&
    (
      isViewActivityValid(activity.object) ||
      isDislikeActivityValid(activity.object) ||
      isFlagActivityValid(activity.object) ||
      isPlaylistObjectValid(activity.object) ||
      isWatchActionObjectValid(activity.object) ||

      isCacheFileObjectValid(activity.object) ||
      sanitizeAndCheckVideoCommentObject(activity.object) ||
      sanitizeAndCheckVideoTorrentObject(activity.object)
    )
}

export function isUpdateActivityValid (activity: any) {
  return isBaseActivityValid(activity, 'Update') &&
    (
      isCacheFileObjectValid(activity.object) ||
      isPlaylistObjectValid(activity.object) ||
      sanitizeAndCheckVideoTorrentObject(activity.object) ||
      sanitizeAndCheckActorObject(activity.object)
    )
}

export function isDeleteActivityValid (activity: any) {
  // We don't really check objects
  return isBaseActivityValid(activity, 'Delete') &&
    isObjectValid(activity.object)
}

export function isFollowActivityValid (activity: any) {
  return isBaseActivityValid(activity, 'Follow') &&
    isObjectValid(activity.object)
}

export function isAcceptActivityValid (activity: any) {
  return isBaseActivityValid(activity, 'Accept')
}

export function isRejectActivityValid (activity: any) {
  return isBaseActivityValid(activity, 'Reject')
}

export function isUndoActivityValid (activity: any) {
  return isBaseActivityValid(activity, 'Undo') &&
    (
      isFollowActivityValid(activity.object) ||
      isLikeActivityValid(activity.object) ||
      isDislikeActivityValid(activity.object) ||
      isAnnounceActivityValid(activity.object) ||
      isCreateActivityValid(activity.object)
    )
}

export function isApproveReplyActivityValid (activity: any) {
  return isBaseActivityValid(activity, 'ApproveReply') &&
    isActivityPubUrlValid(activity.object) &&
    isActivityPubUrlValid(activity.inReplyTo)
}

export function isRejectReplyActivityValid (activity: any) {
  return isBaseActivityValid(activity, 'RejectReply') &&
    isActivityPubUrlValid(activity.object) &&
    isActivityPubUrlValid(activity.inReplyTo)
}
