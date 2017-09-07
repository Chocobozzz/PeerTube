import { values } from 'lodash'
import * as validator from 'validator'
import 'express-validator'

import { exists } from './misc'
import { CONSTRAINTS_FIELDS, USER_ROLES } from '../../initializers'
import { UserRole } from '../../../shared'

const USERS_CONSTRAINTS_FIELDS = CONSTRAINTS_FIELDS.USERS

function isUserPasswordValid (value: string) {
  return validator.isLength(value, USERS_CONSTRAINTS_FIELDS.PASSWORD)
}

function isUserRoleValid (value: string) {
  return values(USER_ROLES).indexOf(value as UserRole) !== -1
}

function isUserVideoQuotaValid (value: string) {
  return exists(value) && validator.isInt(value + '', USERS_CONSTRAINTS_FIELDS.VIDEO_QUOTA)
}

function isUserUsernameValid (value: string) {
  const max = USERS_CONSTRAINTS_FIELDS.USERNAME.max
  const min = USERS_CONSTRAINTS_FIELDS.USERNAME.min
  return exists(value) && validator.matches(value, new RegExp(`^[a-zA-Z0-9._]{${min},${max}}$`))
}

function isUserDisplayNSFWValid (value: any) {
  return typeof value === 'boolean' || (typeof value === 'string' && validator.isBoolean(value))
}

// ---------------------------------------------------------------------------

export {
  isUserPasswordValid,
  isUserRoleValid,
  isUserVideoQuotaValid,
  isUserUsernameValid,
  isUserDisplayNSFWValid
}

declare module 'express-validator' {
  export interface Validator {
    isUserPasswordValid,
    isUserRoleValid,
    isUserUsernameValid,
    isUserDisplayNSFWValid,
    isUserVideoQuotaValid
  }
}
