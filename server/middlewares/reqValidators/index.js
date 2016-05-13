'use strict'

const paginationReqValidators = require('./pagination')
const podsReqValidators = require('./pods')
const remoteReqValidators = require('./remote')
const videosReqValidators = require('./videos')

const reqValidators = {
  pagination: paginationReqValidators,
  pods: podsReqValidators,
  remote: remoteReqValidators,
  videos: videosReqValidators
}

// ---------------------------------------------------------------------------

module.exports = reqValidators
