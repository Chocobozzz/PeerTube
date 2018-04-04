import * as validator from 'validator'
import { ACTIVITY_PUB } from '../../../initializers'
import { exists, isArray, isDateValid } from '../misc'
import { isActivityPubUrlValid, isBaseActivityValid } from './misc'

function isVideoCommentCreateActivityValid (activity: any) {
  return isBaseActivityValid(activity, 'Create') &&
    isVideoCommentObjectValid(activity.object)
}

function isVideoCommentObjectValid (comment: any) {
  return comment.type === 'Note' &&
    isActivityPubUrlValid(comment.id) &&
    isCommentContentValid(comment.content) &&
    isActivityPubUrlValid(comment.inReplyTo) &&
    isDateValid(comment.published) &&
    isActivityPubUrlValid(comment.url) &&
    isArray(comment.to) &&
    (
      comment.to.indexOf(ACTIVITY_PUB.PUBLIC) !== -1 ||
      comment.cc.indexOf(ACTIVITY_PUB.PUBLIC) !== -1
    ) // Only accept public comments
}

function isVideoCommentDeleteActivityValid (activity: any) {
  return isBaseActivityValid(activity, 'Delete')
}

// ---------------------------------------------------------------------------

export {
  isVideoCommentCreateActivityValid,
  isVideoCommentDeleteActivityValid,
  isVideoCommentObjectValid
}

// ---------------------------------------------------------------------------

function isCommentContentValid (content: any) {
  return exists(content) && validator.isLength('' + content, { min: 1 })
}
