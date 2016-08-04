'use strict'

const paginationValidators = require('./pagination')
const podsValidators = require('./pods')
const remoteValidators = require('./remote')
const sortValidators = require('./sort')
const usersValidators = require('./users')
const videosValidators = require('./videos')

const validators = {
  pagination: paginationValidators,
  pods: podsValidators,
  remote: remoteValidators,
  sort: sortValidators,
  users: usersValidators,
  videos: videosValidators
}

// ---------------------------------------------------------------------------

module.exports = validators
