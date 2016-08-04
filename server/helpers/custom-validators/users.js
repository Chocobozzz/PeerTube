'use strict'

const validator = require('express-validator').validator
const values = require('lodash/values')

const constants = require('../../initializers/constants')
const USERS_CONSTRAINTS_FIELDS = constants.CONSTRAINTS_FIELDS.USERS

const usersValidators = {
  isUserPasswordValid: isUserPasswordValid,
  isUserRoleValid: isUserRoleValid,
  isUserUsernameValid: isUserUsernameValid
}

function isUserPasswordValid (value) {
  return validator.isLength(value, USERS_CONSTRAINTS_FIELDS.PASSWORD)
}

function isUserRoleValid (value) {
  return values(constants.USER_ROLES).indexOf(value) !== -1
}

function isUserUsernameValid (value) {
  const max = USERS_CONSTRAINTS_FIELDS.USERNAME.max
  const min = USERS_CONSTRAINTS_FIELDS.USERNAME.min
  return validator.matches(value, new RegExp(`^[a-zA-Z0-9._]{${min},${max}}$`))
}

// ---------------------------------------------------------------------------

module.exports = usersValidators
