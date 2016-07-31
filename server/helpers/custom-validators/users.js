'use strict'

const validator = require('express-validator').validator

const constants = require('../../initializers/constants')
const USERS_CONSTRAINTS_FIELDS = constants.CONSTRAINTS_FIELDS.USERS

const usersValidators = {
  isUserUsernameValid: isUserUsernameValid
}

function isUserUsernameValid (value) {
  return validator.isLength(value, USERS_CONSTRAINTS_FIELDS.USERNAME)
}

// ---------------------------------------------------------------------------

module.exports = usersValidators
