'use strict'

const checkErrors = require('../utils').checkErrors
const logger = require('../../../helpers/logger')

const validatorsRemoteVideos = {
  remoteVideos
}

function remoteVideos (req, res, next) {
  req.checkBody('data').isEachRemoteRequestVideosValid()

  logger.debug('Checking remoteVideos parameters', { parameters: req.body })

  checkErrors(req, res, next)
}

// ---------------------------------------------------------------------------

module.exports = validatorsRemoteVideos
