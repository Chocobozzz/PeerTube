'use strict'

const remoteSignatureValidators = require('./signature')
const remoteVideosValidators = require('./videos')

const validators = {
  signature: remoteSignatureValidators,
  videos: remoteVideosValidators
}

// ---------------------------------------------------------------------------

module.exports = validators
