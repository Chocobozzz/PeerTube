'use strict'

const miscValidators = require('./misc')
const podsValidators = require('./pods')
const usersValidators = require('./users')
const videosValidators = require('./videos')

const validators = {
  misc: miscValidators,
  pods: podsValidators,
  users: usersValidators,
  videos: videosValidators
}

// ---------------------------------------------------------------------------

module.exports = validators
