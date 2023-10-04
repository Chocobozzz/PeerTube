import validator from 'validator'
import { UserRole } from '@peertube/peertube-models'
import { isEmailEnabled } from '../../initializers/config.js'
import { CONSTRAINTS_FIELDS, NSFW_POLICY_TYPES } from '../../initializers/constants.js'
import { exists, isArray, isBooleanValid } from './misc.js'

const USERS_CONSTRAINTS_FIELDS = CONSTRAINTS_FIELDS.USERS

function isUserPasswordValid (value: string) {
  return validator.default.isLength(value, USERS_CONSTRAINTS_FIELDS.PASSWORD)
}

function isUserPasswordValidOrEmpty (value: string) {
  // Empty password is only possible if emailing is enabled.
  if (value === '') return isEmailEnabled()

  return isUserPasswordValid(value)
}

function isUserVideoQuotaValid (value: string) {
  return exists(value) && validator.default.isInt(value + '', USERS_CONSTRAINTS_FIELDS.VIDEO_QUOTA)
}

function isUserVideoQuotaDailyValid (value: string) {
  return exists(value) && validator.default.isInt(value + '', USERS_CONSTRAINTS_FIELDS.VIDEO_QUOTA_DAILY)
}

function isUserUsernameValid (value: string) {
  return exists(value) &&
    validator.default.matches(value, new RegExp(`^[a-z0-9_]+([a-z0-9_.-]+[a-z0-9_]+)?$`)) &&
    validator.default.isLength(value, USERS_CONSTRAINTS_FIELDS.USERNAME)
}

function isUserDisplayNameValid (value: string) {
  return value === null || (exists(value) && validator.default.isLength(value, CONSTRAINTS_FIELDS.USERS.NAME))
}

function isUserDescriptionValid (value: string) {
  return value === null || (exists(value) && validator.default.isLength(value, CONSTRAINTS_FIELDS.USERS.DESCRIPTION))
}

function isUserEmailVerifiedValid (value: any) {
  return isBooleanValid(value)
}

const nsfwPolicies = new Set(Object.values(NSFW_POLICY_TYPES))
function isUserNSFWPolicyValid (value: any) {
  return exists(value) && nsfwPolicies.has(value)
}

function isUserP2PEnabledValid (value: any) {
  return isBooleanValid(value)
}

function isUserVideosHistoryEnabledValid (value: any) {
  return isBooleanValid(value)
}

function isUserAutoPlayVideoValid (value: any) {
  return isBooleanValid(value)
}

function isUserVideoLanguages (value: any) {
  return value === null || (isArray(value) && value.length < CONSTRAINTS_FIELDS.USERS.VIDEO_LANGUAGES.max)
}

function isUserAdminFlagsValid (value: any) {
  return exists(value) && validator.default.isInt('' + value)
}

function isUserBlockedValid (value: any) {
  return isBooleanValid(value)
}

function isUserAutoPlayNextVideoValid (value: any) {
  return isBooleanValid(value)
}

function isUserAutoPlayNextVideoPlaylistValid (value: any) {
  return isBooleanValid(value)
}

function isUserEmailPublicValid (value: any) {
  return isBooleanValid(value)
}

function isUserNoModal (value: any) {
  return isBooleanValid(value)
}

function isUserBlockedReasonValid (value: any) {
  return value === null || (exists(value) && validator.default.isLength(value, CONSTRAINTS_FIELDS.USERS.BLOCKED_REASON))
}

function isUserRoleValid (value: any) {
  return exists(value) &&
    validator.default.isInt('' + value) &&
    [ UserRole.ADMINISTRATOR, UserRole.MODERATOR, UserRole.USER ].includes(value)
}

// ---------------------------------------------------------------------------

export {
  isUserVideosHistoryEnabledValid,
  isUserBlockedValid,
  isUserPasswordValid,
  isUserPasswordValidOrEmpty,
  isUserVideoLanguages,
  isUserBlockedReasonValid,
  isUserRoleValid,
  isUserVideoQuotaValid,
  isUserVideoQuotaDailyValid,
  isUserUsernameValid,
  isUserAdminFlagsValid,
  isUserEmailVerifiedValid,
  isUserNSFWPolicyValid,
  isUserP2PEnabledValid,
  isUserAutoPlayVideoValid,
  isUserAutoPlayNextVideoValid,
  isUserAutoPlayNextVideoPlaylistValid,
  isUserDisplayNameValid,
  isUserDescriptionValid,
  isUserEmailPublicValid,
  isUserNoModal
}
