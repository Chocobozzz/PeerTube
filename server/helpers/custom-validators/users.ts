import { values } from 'lodash'
import validator from 'validator'
import { UserRole } from '../../../shared'
import { isEmailEnabled } from '../../initializers/config'
import { CONSTRAINTS_FIELDS, NSFW_POLICY_TYPES } from '../../initializers/constants'
import { exists, isArray, isBooleanValid } from './misc'

const USERS_CONSTRAINTS_FIELDS = CONSTRAINTS_FIELDS.USERS

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

function checkUserVideoLanguages (value: any) {
  if (value === null) return true
  if (!isArray(value)) throw new Error('Should have an array of user video languages')
  const maxLength = CONSTRAINTS_FIELDS.USERS.VIDEO_LANGUAGES.max
  if (value.length >= maxLength) throw new Error(`Should have a array of user video languages not exceeding ${maxLength} languages`)
  return true
}

function checkUserBlockedReason (value: any) {
  if (value === null) return true
  if (!exists(value)) throw new Error('Should have a reason to block the user')
  const max = CONSTRAINTS_FIELDS.USERS.BLOCKED_REASON.max
  const min = CONSTRAINTS_FIELDS.USERS.BLOCKED_REASON.min
  if (!validator.isLength(value, CONSTRAINTS_FIELDS.USERS.BLOCKED_REASON)) {
    throw new Error(`Should have a reason to block the user that is between ${min} and ${max} alphanumeric characters long`)
  }
  return true
}

function checkUserRole (value: any) {
  if (!exists(value)) throw new Error('Should have a user role')
  if (!validator.isInt('' + value)) throw new Error('Should have a user role that is an integer')
  if (UserRole[value] === undefined) throw new Error('Should have a user role that is a known user role')
  return true
}

function checkUserAdminFlags (value: any) {
  if (!exists(value)) throw new Error('Should have an admin flag value')
  if (!validator.isInt('' + value)) throw new Error('Should have an admin flag that is an integer')
  return true
}

function checkUserPassword (value: string) {
  const max = USERS_CONSTRAINTS_FIELDS.PASSWORD.max
  const min = USERS_CONSTRAINTS_FIELDS.PASSWORD.min
  if (!validator.isLength(value, USERS_CONSTRAINTS_FIELDS.PASSWORD)) {
    throw new Error(`Should have a password that is between ${min} and ${max} alphanumeric characters long`)
  }
  return true
}

function checkUserPasswordValidOrEmpty (value: string) {
  // Empty password is only possible if emailing is enabled.
  if (value === '' && !isEmailEnabled()) throw new Error('Should have a password since emailing is not enabled')
  if (value === '') return true

  checkUserPassword(value)
  return true
}

function checkUserVideoQuota (value: string) {
  if (!exists(value)) throw new Error('Should have a user video quota value')
  const min = USERS_CONSTRAINTS_FIELDS.VIDEO_QUOTA.min
  if (!validator.isInt(value + '', USERS_CONSTRAINTS_FIELDS.VIDEO_QUOTA)) {
    throw new Error(`Should have a user video quota that is at least ${min}`)
  }
  return true
}

function checkUserVideoQuotaDaily (value: string) {
  if (!exists(value)) throw new Error('Should have a user daily video quota value')
  const min = USERS_CONSTRAINTS_FIELDS.VIDEO_QUOTA_DAILY.min
  if (!validator.isInt(value + '', USERS_CONSTRAINTS_FIELDS.VIDEO_QUOTA_DAILY)) {
    throw new Error(`Should have a user daily video quota that is at least ${min}`)
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

// ---------------------------------------------------------------------------

export {
  isUserVideosHistoryEnabledValid,
  isUserBlockedValid,
  checkUserPassword,
  checkUserPasswordValidOrEmpty,
  checkUserVideoLanguages,
  checkUserBlockedReason,
  checkUserRole,
  checkUserVideoQuota,
  checkUserVideoQuotaDaily,
  checkUserUsername,
  checkUserAdminFlags,
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
