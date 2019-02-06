import * as validator from 'validator'
import { ACTIVITY_PUB, CONSTRAINTS_FIELDS } from '../../../initializers'
import { exists, isArray, isDateValid } from '../misc'
import { isActivityPubUrlValid, isBaseActivityValid } from './misc'

function sanitizeAndCheckVideoCommentObject (comment: any) {
  if (!comment || comment.type !== 'Note') return false

  normalizeComment(comment)

  return isActivityPubUrlValid(comment.id) &&
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

// ---------------------------------------------------------------------------

export {
  sanitizeAndCheckVideoCommentObject
}

// ---------------------------------------------------------------------------

function isCommentContentValid (content: any) {
  return exists(content) && validator.isLength('' + content, { min: 1 })
}

function normalizeComment (comment: any) {
  if (!comment) return

  if (typeof comment.url !== 'string') {
    comment.url = comment.url.href || comment.url.url
  }

  return
}
