'use strict'

const podsReqValidators = require('./pods')
const remoteReqValidators = require('./remote')
const videosReqValidators = require('./videos')

const reqValidators = {
  pods: podsReqValidators,
  remote: remoteReqValidators,
  videos: videosReqValidators
}

// ---------------------------------------------------------------------------

module.exports = reqValidators
