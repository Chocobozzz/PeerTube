'use strict'

const paginationReqValidators = require('./pagination')
const podsReqValidators = require('./pods')
const remoteReqValidators = require('./remote')
const sortReqValidators = require('./sort')
const videosReqValidators = require('./videos')

const reqValidators = {
  pagination: paginationReqValidators,
  pods: podsReqValidators,
  remote: remoteReqValidators,
  sort: sortReqValidators,
  videos: videosReqValidators
}

// ---------------------------------------------------------------------------

module.exports = reqValidators
