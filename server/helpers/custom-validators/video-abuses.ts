import validator from 'validator'
import { keys } from 'lodash'

import { CONSTRAINTS_FIELDS, VIDEO_ABUSE_STATES } from '../../initializers/constants'
import { exists } from './misc'
import { VideoAbuseVideoIs } from '@shared/models/videos/abuse/video-abuse-video-is.type'
import { VideoAbusePredefinedReasonsIn } from '@shared/models/videos/abuse/video-abuse-reason.model'

const VIDEO_ABUSES_CONSTRAINTS_FIELDS = CONSTRAINTS_FIELDS.VIDEO_ABUSES

function isVideoAbuseReasonValid (value: string) {
  return exists(value) && validator.isLength(value, VIDEO_ABUSES_CONSTRAINTS_FIELDS.REASON)
}

function isVideoAbusePredefinedReasonsValid (value: VideoAbusePredefinedReasonsIn[]) {
  return exists(value) && value.every(element => keys(VideoAbusePredefinedReasonsIn).includes(element))
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
  isVideoAbusePredefinedReasonsValid,
  isVideoAbuseModerationCommentValid,
  isVideoAbuseStateValid,
  isAbuseVideoIsValid
}
