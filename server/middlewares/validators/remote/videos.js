'use strict'

const checkErrors = require('../utils').checkErrors
const logger = require('../../../helpers/logger')

const validatorsRemoteVideos = {
  remoteVideos,
  remoteQaduVideos,
  remoteEventsVideos
}

function remoteVideos (req, res, next) {
  req.checkBody('data').isEachRemoteRequestVideosValid()

  logger.debug('Checking remoteVideos parameters', { parameters: req.body })

  checkErrors(req, res, next)
}

function remoteQaduVideos (req, res, next) {
  req.checkBody('data').isEachRemoteRequestVideosQaduValid()

  logger.debug('Checking remoteQaduVideos parameters', { parameters: req.body })

  checkErrors(req, res, next)
}

function remoteEventsVideos (req, res, next) {
  req.checkBody('data').isEachRemoteRequestVideosEventsValid()

  logger.debug('Checking remoteEventsVideos parameters', { parameters: req.body })

  checkErrors(req, res, next)
}
// ---------------------------------------------------------------------------

module.exports = validatorsRemoteVideos
