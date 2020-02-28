import validator from 'validator'
import { UserRole } from '../../../shared'
import { CONSTRAINTS_FIELDS, NSFW_POLICY_TYPES } from '../../initializers/constants'
import { exists, isArray, isBooleanValid, isFileValid } from './misc'
import { values } from 'lodash'
import { isEmailEnabled } from '../../initializers/config'

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

function isUserUsernameValid (value: string) {
  const max = USERS_CONSTRAINTS_FIELDS.USERNAME.max
  const min = USERS_CONSTRAINTS_FIELDS.USERNAME.min
  return exists(value) && validator.matches(value, new RegExp(`^[a-z0-9._]{${min},${max}}$`))
}

function isUserDisplayNameValid (value: string) {
  return value === null || (exists(value) && validator.isLength(value, CONSTRAINTS_FIELDS.USERS.NAME))
}

function isUserDescriptionValid (value: string) {
  return value === null || (exists(value) && validator.isLength(value, CONSTRAINTS_FIELDS.USERS.DESCRIPTION))
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

const avatarMimeTypes = CONSTRAINTS_FIELDS.ACTORS.AVATAR.EXTNAME
  .map(v => v.replace('.', ''))
  .join('|')
const avatarMimeTypesRegex = `image/(${avatarMimeTypes})`
function isAvatarFile (files: { [ fieldname: string ]: Express.Multer.File[] } | Express.Multer.File[]) {
  return isFileValid(files, avatarMimeTypesRegex, 'avatarfile', CONSTRAINTS_FIELDS.ACTORS.AVATAR.FILE_SIZE.max)
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
  isUserWebTorrentEnabledValid,
  isUserAutoPlayVideoValid,
  isUserAutoPlayNextVideoValid,
  isUserAutoPlayNextVideoPlaylistValid,
  isUserDisplayNameValid,
  isUserDescriptionValid,
  isNoInstanceConfigWarningModal,
  isNoWelcomeModal,
  isAvatarFile
}
