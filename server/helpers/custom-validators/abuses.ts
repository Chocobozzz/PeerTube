import validator from 'validator'
import { abusePredefinedReasonsMap, AbusePredefinedReasonsString, AbuseVideoIs } from '@shared/models'
import { CONSTRAINTS_FIELDS, ABUSE_STATES } from '../../initializers/constants'
import { exists, isArray } from './misc'

const VIDEO_ABUSES_CONSTRAINTS_FIELDS = CONSTRAINTS_FIELDS.ABUSES

function isAbuseReasonValid (value: string) {
  return exists(value) && validator.isLength(value, VIDEO_ABUSES_CONSTRAINTS_FIELDS.REASON)
}

function isAbusePredefinedReasonValid (value: AbusePredefinedReasonsString) {
  return exists(value) && value in abusePredefinedReasonsMap
}

function isAbusePredefinedReasonsValid (value: AbusePredefinedReasonsString[]) {
  return exists(value) && isArray(value) && value.every(v => v in abusePredefinedReasonsMap)
}

function isAbuseTimestampValid (value: number) {
  return value === null || (exists(value) && validator.isInt('' + value, { min: 0 }))
}

function isAbuseTimestampCoherent (endAt: number, { req }) {
  return exists(req.body.startAt) && endAt > req.body.startAt
}

function isAbuseModerationCommentValid (value: string) {
  return exists(value) && validator.isLength(value, VIDEO_ABUSES_CONSTRAINTS_FIELDS.MODERATION_COMMENT)
}

function isAbuseStateValid (value: string) {
  return exists(value) && ABUSE_STATES[value] !== undefined
}

function isAbuseVideoIsValid (value: AbuseVideoIs) {
  return exists(value) && (
    value === 'deleted' ||
    value === 'blacklisted'
  )
}

// ---------------------------------------------------------------------------

export {
  isAbuseReasonValid,
  isAbusePredefinedReasonValid,
  isAbusePredefinedReasonsValid,
  isAbuseTimestampValid,
  isAbuseTimestampCoherent,
  isAbuseModerationCommentValid,
  isAbuseStateValid,
  isAbuseVideoIsValid
}
