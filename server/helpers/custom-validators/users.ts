import 'express-validator'
import * as validator from 'validator'
import { UserRole } from '../../../shared'
import { CONSTRAINTS_FIELDS, NSFW_POLICY_TYPES } from '../../initializers'
import { exists, isFileValid, isBooleanValid } from './misc'
import { values } from 'lodash'

const USERS_CONSTRAINTS_FIELDS = CONSTRAINTS_FIELDS.USERS

function isUserPasswordValid (value: string) {
  return validator.isLength(value, USERS_CONSTRAINTS_FIELDS.PASSWORD)
}

function isUserVideoQuotaValid (value: string) {
  return exists(value) && validator.isInt(value + '', USERS_CONSTRAINTS_FIELDS.VIDEO_QUOTA)
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

const nsfwPolicies = values(NSFW_POLICY_TYPES)
function isUserNSFWPolicyValid (value: any) {
  return exists(value) && nsfwPolicies.indexOf(value) !== -1
}

function isUserAutoPlayVideoValid (value: any) {
  return isBooleanValid(value)
}

function isUserBlockedValid (value: any) {
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
  isUserBlockedValid,
  isUserPasswordValid,
  isUserBlockedReasonValid,
  isUserRoleValid,
  isUserVideoQuotaValid,
  isUserUsernameValid,
  isUserNSFWPolicyValid,
  isUserAutoPlayVideoValid,
  isUserDisplayNameValid,
  isUserDescriptionValid,
  isAvatarFile
}
