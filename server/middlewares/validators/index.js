'use strict'

const paginationValidators = require('./pagination')
const podsValidators = require('./pods')
const remoteValidators = require('./remote')
const sortValidators = require('./sort')
const videosValidators = require('./videos')

const validators = {
  pagination: paginationValidators,
  pods: podsValidators,
  remote: remoteValidators,
  sort: sortValidators,
  videos: videosValidators
}

// ---------------------------------------------------------------------------

module.exports = validators
