import { hasAPPublic } from '@server/helpers/activity-pub-utils.js'
import validator from 'validator'
import { exists, isArray, isDateValid } from '../misc.js'
import { isActivityPubUrlValid } from './misc.js'
import { ActivityTombstoneObject, VideoCommentObject } from '@peertube/peertube-models'

function sanitizeAndCheckVideoCommentObject (comment: VideoCommentObject | ActivityTombstoneObject) {
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
    (!exists(comment.replyApproval) || isActivityPubUrlValid(comment.replyApproval)) &&
    (hasAPPublic(comment.to) || hasAPPublic(comment.cc)) // Only accept public comments
}

// ---------------------------------------------------------------------------

export {
  sanitizeAndCheckVideoCommentObject
}

// ---------------------------------------------------------------------------

function isCommentContentValid (content: any) {
  return exists(content) && validator.default.isLength('' + content, { min: 1 })
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
