import validator from 'validator'
import { AbuseFilter, abusePredefinedReasonsMap, AbusePredefinedReasonsString, AbuseVideoIs, AbuseCreate } from '@shared/models'
import { ABUSE_STATES, CONSTRAINTS_FIELDS } from '../../initializers/constants'
import { exists, isArray } from './misc'

const ABUSES_CONSTRAINTS_FIELDS = CONSTRAINTS_FIELDS.ABUSES

function isAbuseReasonValid (value: string) {
  return exists(value) && validator.isLength(value, ABUSES_CONSTRAINTS_FIELDS.REASON)
}

function isAbusePredefinedReasonValid (value: AbusePredefinedReasonsString) {
  return exists(value) && value in abusePredefinedReasonsMap
}

function isAbuseFilterValid (value: AbuseFilter) {
  return value === 'video' || value === 'comment' || value === 'account'
}

function areAbusePredefinedReasonsValid (value: AbusePredefinedReasonsString[]) {
  return exists(value) && isArray(value) && value.every(v => v in abusePredefinedReasonsMap)
}

function isAbuseTimestampValid (value: number) {
  return value === null || (exists(value) && validator.isInt('' + value, { min: 0 }))
}

function isAbuseTimestampCoherent (endAt: number, { req }) {
  const startAt = (req.body as AbuseCreate).video.startAt

  return exists(startAt) && endAt > startAt
}

function isAbuseModerationCommentValid (value: string) {
  return exists(value) && validator.isLength(value, ABUSES_CONSTRAINTS_FIELDS.MODERATION_COMMENT)
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
  isAbuseFilterValid,
  isAbusePredefinedReasonValid,
  areAbusePredefinedReasonsValid as isAbusePredefinedReasonsValid,
  isAbuseTimestampValid,
  isAbuseTimestampCoherent,
  isAbuseModerationCommentValid,
  isAbuseStateValid,
  isAbuseVideoIsValid
}
