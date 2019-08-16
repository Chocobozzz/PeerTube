import { Response } from 'express'
import * as validator from 'validator'
import { CONSTRAINTS_FIELDS, VIDEO_ABUSE_STATES } from '../../initializers/constants'
import { exists } from './misc'
import { VideoAbuseModel } from '../../models/video/video-abuse'

const VIDEO_ABUSES_CONSTRAINTS_FIELDS = CONSTRAINTS_FIELDS.VIDEO_ABUSES

function isVideoAbuseReasonValid (value: string) {
  return exists(value) && validator.isLength(value, VIDEO_ABUSES_CONSTRAINTS_FIELDS.REASON)
}

function isVideoAbuseModerationCommentValid (value: string) {
  return exists(value) && validator.isLength(value, VIDEO_ABUSES_CONSTRAINTS_FIELDS.MODERATION_COMMENT)
}

function isVideoAbuseStateValid (value: string) {
  return exists(value) && VIDEO_ABUSE_STATES[ value ] !== undefined
}

// ---------------------------------------------------------------------------

export {
  isVideoAbuseStateValid,
  isVideoAbuseReasonValid,
  isVideoAbuseModerationCommentValid
}
