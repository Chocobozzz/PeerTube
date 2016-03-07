'use strict'

var podsReqValidators = require('./pods')
var remoteReqValidators = require('./remote')
var videosReqValidators = require('./videos')

var reqValidators = {
  pods: podsReqValidators,
  remote: remoteReqValidators,
  videos: videosReqValidators
}

// ---------------------------------------------------------------------------

module.exports = reqValidators
