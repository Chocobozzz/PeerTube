import 'express-validator'
import * as validator from 'validator'
import { UserRole } from '../../../shared'
import { CONSTRAINTS_FIELDS } from '../../initializers'

import { exists, isFileValid } from './misc'

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

function isUserDescriptionValid (value: string) {
  return value === null || (exists(value) && validator.isLength(value, CONSTRAINTS_FIELDS.USERS.DESCRIPTION))
}

function isBoolean (value: any) {
  return typeof value === 'boolean' || (typeof value === 'string' && validator.isBoolean(value))
}

function isUserDisplayNSFWValid (value: any) {
  return isBoolean(value)
}

function isUserAutoPlayVideoValid (value: any) {
  return isBoolean(value)
}

function isUserRoleValid (value: any) {
  return exists(value) && validator.isInt('' + value) && UserRole[value] !== undefined
}

const avatarMimeTypes = CONSTRAINTS_FIELDS.ACTORS.AVATAR.EXTNAME
  .map(v => v.replace('.', ''))
  .join('|')
const avatarMimeTypesRegex = `image/(${avatarMimeTypes})`
function isAvatarFile (files: { [ fieldname: string ]: Express.Multer.File[] } | Express.Multer.File[]) {
  return isFileValid(files, avatarMimeTypesRegex, 'avatarfile')
}

// ---------------------------------------------------------------------------

export {
  isUserPasswordValid,
  isUserRoleValid,
  isUserVideoQuotaValid,
  isUserUsernameValid,
  isUserDisplayNSFWValid,
  isUserAutoPlayVideoValid,
  isUserDescriptionValid,
  isAvatarFile
}
