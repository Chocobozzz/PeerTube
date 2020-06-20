import validator from 'validator'

import { CONSTRAINTS_FIELDS, VIDEO_ABUSE_STATES } from '../../initializers/constants'
import { exists, isArray } from './misc'
import { VideoAbuseVideoIs } from '@shared/models/videos/abuse/video-abuse-video-is.type'
import { VideoAbusePredefinedReasonsString, VideoAbusePredefinedReasonsMap } from '@shared/models/videos/abuse/video-abuse-reason.model'

const VIDEO_ABUSES_CONSTRAINTS_FIELDS = CONSTRAINTS_FIELDS.VIDEO_ABUSES

function isVideoAbuseReasonValid (value: string) {
  return exists(value) && validator.isLength(value, VIDEO_ABUSES_CONSTRAINTS_FIELDS.REASON)
}

function isVideoAbusePredefinedReasonValid (value: VideoAbusePredefinedReasonsString) {
  return exists(value) && value in VideoAbusePredefinedReasonsMap
}

function isVideoAbusePredefinedReasonsValid (value: VideoAbusePredefinedReasonsString[]) {
  return exists(value) && isArray(value) && value.every(v => v in VideoAbusePredefinedReasonsMap)
}

function isVideoAbuseTimestampValid (value: number) {
  return value === null || (exists(value) && validator.isInt('' + value, { min: 0 }))
}

function isVideoAbuseModerationCommentValid (value: string) {
  return exists(value) && validator.isLength(value, VIDEO_ABUSES_CONSTRAINTS_FIELDS.MODERATION_COMMENT)
}

function isVideoAbuseStateValid (value: string) {
  return exists(value) && VIDEO_ABUSE_STATES[value] !== undefined
}

function isAbuseVideoIsValid (value: VideoAbuseVideoIs) {
  return exists(value) && (
    value === 'deleted' ||
    value === 'blacklisted'
  )
}

// ---------------------------------------------------------------------------

export {
  isVideoAbuseReasonValid,
  isVideoAbusePredefinedReasonValid,
  isVideoAbusePredefinedReasonsValid,
  isVideoAbuseTimestampValid,
  isVideoAbuseModerationCommentValid,
  isVideoAbuseStateValid,
  isAbuseVideoIsValid
}
