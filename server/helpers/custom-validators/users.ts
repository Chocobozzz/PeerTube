import { values } from 'lodash'
import validator from 'validator'
import { UserRole } from '../../../shared'
import { isEmailEnabled } from '../../initializers/config'
import { CONSTRAINTS_FIELDS, NSFW_POLICY_TYPES } from '../../initializers/constants'
import { exists, isArray, isBooleanValid } from './misc'

const USERS_CONSTRAINTS_FIELDS = CONSTRAINTS_FIELDS.USERS

function isUserPasswordValid (value: string) {
  return validator.isLength(value, USERS_CONSTRAINTS_FIELDS.PASSWORD)
}

function isUserPasswordValidOrEmpty (value: string) {
  // Empty password is only possible if emailing is enabled.
  if (value === '') return isEmailEnabled()

  return isUserPasswordValid(value)
}

function isUserVideoQuotaValid (value: string) {
  return exists(value) && validator.isInt(value + '', USERS_CONSTRAINTS_FIELDS.VIDEO_QUOTA)
}

function isUserVideoQuotaDailyValid (value: string) {
  return exists(value) && validator.isInt(value + '', USERS_CONSTRAINTS_FIELDS.VIDEO_QUOTA_DAILY)
}

function checkUserUsername (value: string) {
  if (!exists(value)) throw new Error('Should have a name')
  const max = USERS_CONSTRAINTS_FIELDS.USERNAME.max
  const min = USERS_CONSTRAINTS_FIELDS.USERNAME.min
  if (!validator.matches(value, new RegExp(`^[a-z0-9._]{${min},${max}}$`))) {
    throw new Error(`Should have a name between ${min} and ${max} alphanumeric characters long`)
  }
  return true
}

function checkUserDisplayName (value: string) {
  if (value === null) return true
  if (!exists(value)) throw new Error('Should have a user display name')
  if (!validator.isLength(value, CONSTRAINTS_FIELDS.USERS.NAME)) {
    const min = CONSTRAINTS_FIELDS.USERS.DESCRIPTION.min
    const max = CONSTRAINTS_FIELDS.USERS.DESCRIPTION.max
    throw new Error(`Should have a user display name between ${min} and ${max} characters long`)
  }
  return true
}

function checkUserDescription (value: string) {
  if (value === null) return true
  if (!exists(value)) throw new Error('Should have a user description')
  if (!validator.isLength(value, CONSTRAINTS_FIELDS.USERS.DESCRIPTION)) {
    const min = CONSTRAINTS_FIELDS.USERS.DESCRIPTION.min
    const max = CONSTRAINTS_FIELDS.USERS.DESCRIPTION.max
    throw new Error(`Should have a user description between ${min} and ${max} characters long`)
  }
  return true
}

function isUserEmailVerifiedValid (value: any) {
  return isBooleanValid(value)
}

const nsfwPolicies = values(NSFW_POLICY_TYPES)
function isUserNSFWPolicyValid (value: any) {
  return exists(value) && nsfwPolicies.includes(value)
}

function isUserWebTorrentEnabledValid (value: any) {
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
  return exists(value) && validator.isInt('' + value)
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

function isNoInstanceConfigWarningModal (value: any) {
  return isBooleanValid(value)
}

function isNoWelcomeModal (value: any) {
  return isBooleanValid(value)
}

function isUserBlockedReasonValid (value: any) {
  return value === null || (exists(value) && validator.isLength(value, CONSTRAINTS_FIELDS.USERS.BLOCKED_REASON))
}

function isUserRoleValid (value: any) {
  return exists(value) && validator.isInt('' + value) && UserRole[value] !== undefined
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
  checkUserUsername,
  isUserAdminFlagsValid,
  isUserEmailVerifiedValid,
  isUserNSFWPolicyValid,
  isUserWebTorrentEnabledValid,
  isUserAutoPlayVideoValid,
  isUserAutoPlayNextVideoValid,
  isUserAutoPlayNextVideoPlaylistValid,
  checkUserDisplayName,
  checkUserDescription,
  isNoInstanceConfigWarningModal,
  isNoWelcomeModal
}
