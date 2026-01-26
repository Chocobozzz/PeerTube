import { AVAILABLE_LOCALES } from '@peertube/peertube-core-utils'
import { UserRole } from '@peertube/peertube-models'
import validator from 'validator'
import { isEmailEnabled } from '../../initializers/config.js'
import { CONSTRAINTS_FIELDS, NSFW_POLICY_TYPES } from '../../initializers/constants.js'
import { exists, isArray, isBooleanValid } from './misc.js'

const USERS_CONSTRAINTS_FIELDS = CONSTRAINTS_FIELDS.USERS

export function isUserPasswordValid (value: string) {
  return validator.default.isLength(value, { min: USERS_CONSTRAINTS_FIELDS.PASSWORD.min }) &&
    isUserPasswordTooLong(value) !== true
}

export function isUserPasswordTooLong (value: string) {
  return !validator.default.isLength(value, { max: USERS_CONSTRAINTS_FIELDS.PASSWORD.max }) ||
    Buffer.byteLength(value, 'utf8') > USERS_CONSTRAINTS_FIELDS.PASSWORD.maxBytes
}

export function isUserPasswordValidOrEmpty (value: string) {
  // Empty password is only possible if emailing is enabled.
  if (value === '') return isEmailEnabled()

  return isUserPasswordValid(value)
}

export function isUserVideoQuotaValid (value: string) {
  return exists(value) && validator.default.isInt(value + '', USERS_CONSTRAINTS_FIELDS.VIDEO_QUOTA)
}

export function isUserVideoQuotaDailyValid (value: string) {
  return exists(value) && validator.default.isInt(value + '', USERS_CONSTRAINTS_FIELDS.VIDEO_QUOTA_DAILY)
}

export function isUserUsernameValid (value: string) {
  return exists(value) &&
    validator.default.matches(value, new RegExp(`^[a-z0-9_]+([a-z0-9_.-]+[a-z0-9_]+)?$`)) &&
    validator.default.isLength(value, USERS_CONSTRAINTS_FIELDS.USERNAME)
}

export function isUserDisplayNameValid (value: string) {
  return value === null || (exists(value) && validator.default.isLength(value, CONSTRAINTS_FIELDS.USERS.NAME))
}

export function isUserDescriptionValid (value: string) {
  return value === null || (exists(value) && validator.default.isLength(value, CONSTRAINTS_FIELDS.USERS.DESCRIPTION))
}

export function isUserEmailVerifiedValid (value: any) {
  return isBooleanValid(value)
}

const nsfwPolicies = new Set(Object.values(NSFW_POLICY_TYPES))
export function isUserNSFWPolicyValid (value: any) {
  return exists(value) && nsfwPolicies.has(value)
}

export function isUserP2PEnabledValid (value: any) {
  return isBooleanValid(value)
}

export function isUserVideosHistoryEnabledValid (value: any) {
  return isBooleanValid(value)
}

export function isUserAutoPlayVideoValid (value: any) {
  return isBooleanValid(value)
}

export function isUserVideoLanguages (value: any) {
  return value === null || (isArray(value) && value.length < CONSTRAINTS_FIELDS.USERS.VIDEO_LANGUAGES.max)
}

export function isUserLanguage (value: any) {
  return value === null || AVAILABLE_LOCALES.includes(value)
}

export function isUserAdminFlagsValid (value: any) {
  return exists(value) && validator.default.isInt('' + value)
}

export function isUserBlockedValid (value: any) {
  return isBooleanValid(value)
}

export function isUserAutoPlayNextVideoValid (value: any) {
  return isBooleanValid(value)
}

export function isUserAutoPlayNextVideoPlaylistValid (value: any) {
  return isBooleanValid(value)
}

export function isUserEmailPublicValid (value: any) {
  return isBooleanValid(value)
}

export function isUserNoModal (value: any) {
  return isBooleanValid(value)
}

export function isUserBlockedReasonValid (value: any) {
  return value === null || (exists(value) && validator.default.isLength(value, CONSTRAINTS_FIELDS.USERS.BLOCKED_REASON))
}

export function isUserRoleValid (value: any) {
  return exists(value) &&
    validator.default.isInt('' + value) &&
    [ UserRole.ADMINISTRATOR, UserRole.MODERATOR, UserRole.USER ].includes(value)
}

export function isUserFeatureInfo (value: string) {
  return exists(value) && validator.default.isInt(value + '')
}
