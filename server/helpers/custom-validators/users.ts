import * as validator from 'validator'
import 'express-validator'

import { exists, isArray } from './misc'
import { CONSTRAINTS_FIELDS } from '../../initializers'
import { UserRole } from '../../../shared'

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

function isAvatarFile (files: { [ fieldname: string ]: Express.Multer.File[] } | Express.Multer.File[]) {
  // Should have files
  if (!files) return false
  if (isArray(files)) return false

  // Should have videofile file
  const avatarfile = files['avatarfile']
  if (!avatarfile || avatarfile.length === 0) return false

  // The file should exist
  const file = avatarfile[0]
  if (!file || !file.originalname) return false

  return new RegExp('^image/(png|jpeg)$', 'i').test(file.mimetype)
}

// ---------------------------------------------------------------------------

export {
  isUserPasswordValid,
  isUserRoleValid,
  isUserVideoQuotaValid,
  isUserUsernameValid,
  isUserDisplayNSFWValid,
  isUserAutoPlayVideoValid,
  isAvatarFile
}
