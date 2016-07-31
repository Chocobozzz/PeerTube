'use strict'

const miscValidators = require('./misc')
const usersValidators = require('./users')
const videosValidators = require('./videos')

const validators = {
  misc: miscValidators,
  users: usersValidators,
  videos: videosValidators
}

// ---------------------------------------------------------------------------

module.exports = validators
