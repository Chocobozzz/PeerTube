'use strict'

const miscValidators = require('./misc')
const podsValidators = require('./pods')
const remoteValidators = require('./remote')
const usersValidators = require('./users')
const videosValidators = require('./videos')

const validators = {
  misc: miscValidators,
  pods: podsValidators,
  remote: remoteValidators,
  users: usersValidators,
  videos: videosValidators
}

// ---------------------------------------------------------------------------

module.exports = validators
