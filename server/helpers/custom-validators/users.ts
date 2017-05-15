import { values } from 'lodash'
import expressValidator = require('express-validator')
// TODO: use .validator when express-validator typing will have validator field
const validator = expressValidator['validator']

import { CONSTRAINTS_FIELDS, USER_ROLES } from '../../initializers'
const USERS_CONSTRAINTS_FIELDS = CONSTRAINTS_FIELDS.USERS

function isUserPasswordValid (value) {
  return validator.isLength(value, USERS_CONSTRAINTS_FIELDS.PASSWORD)
}

function isUserRoleValid (value) {
  return values(USER_ROLES).indexOf(value) !== -1
}

function isUserUsernameValid (value) {
  const max = USERS_CONSTRAINTS_FIELDS.USERNAME.max
  const min = USERS_CONSTRAINTS_FIELDS.USERNAME.min
  return validator.matches(value, new RegExp(`^[a-zA-Z0-9._]{${min},${max}}$`))
}

function isUserDisplayNSFWValid (value) {
  return validator.isBoolean(value)
}

// ---------------------------------------------------------------------------

export {
  isUserPasswordValid,
  isUserRoleValid,
  isUserUsernameValid,
  isUserDisplayNSFWValid
}
