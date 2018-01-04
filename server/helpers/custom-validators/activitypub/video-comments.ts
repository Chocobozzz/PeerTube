import * as validator from 'validator'
import { exists, isDateValid } from '../misc'
import { isActivityPubUrlValid, isBaseActivityValid } from './misc'
import * as sanitizeHtml from 'sanitize-html'

function isVideoCommentCreateActivityValid (activity: any) {
  return isBaseActivityValid(activity, 'Create') &&
    isVideoCommentObjectValid(activity.object)
}

function isVideoCommentObjectValid (comment: any) {
  return comment.type === 'Note' &&
    isActivityPubUrlValid(comment.id) &&
    sanitizeCommentHTML(comment) &&
    isCommentContentValid(comment.content) &&
    isActivityPubUrlValid(comment.inReplyTo) &&
    isDateValid(comment.published) &&
    isActivityPubUrlValid(comment.url)
}

function isVideoCommentDeleteActivityValid (activity: any) {
  return isBaseActivityValid(activity, 'Delete')
}

// ---------------------------------------------------------------------------

export {
  isVideoCommentCreateActivityValid,
  isVideoCommentDeleteActivityValid
}

// ---------------------------------------------------------------------------

function sanitizeCommentHTML (comment: any) {
  return sanitizeHtml(comment.content, {
    allowedTags: [ 'b', 'i', 'em', 'span', 'a' ],
    allowedAttributes: {
      'a': [ 'href' ]
    }
  })
}

function isCommentContentValid (content: any) {
  return exists(content) && validator.isLength('' + content, { min: 1 })
}
