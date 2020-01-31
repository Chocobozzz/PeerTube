import validator from 'validator'
import { ACTIVITY_PUB } from '../../../initializers/constants'
import { exists, isArray, isDateValid } from '../misc'
import { isActivityPubUrlValid } from './misc'

function sanitizeAndCheckVideoCommentObject (comment: any) {
  if (!comment) return false

  if (!isCommentTypeValid(comment)) return false

  normalizeComment(comment)

  if (comment.type === 'Tombstone') {
    return isActivityPubUrlValid(comment.id) &&
      isDateValid(comment.published) &&
      isDateValid(comment.deleted) &&
      isActivityPubUrlValid(comment.url)
  }

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
    if (typeof comment.url === 'object') comment.url = comment.url.href || comment.url.url
    else comment.url = comment.id
  }
}

function isCommentTypeValid (comment: any): boolean {
  if (comment.type === 'Note') return true

  if (comment.type === 'Tombstone' && comment.formerType === 'Note') return true

  return false
}
