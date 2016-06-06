'use strict'

const checkErrors = require('./utils').checkErrors
const logger = require('../../helpers/logger')

const reqValidatorsRemote = {
  remoteVideosAdd: remoteVideosAdd,
  remoteVideosRemove: remoteVideosRemove,
  secureRequest: secureRequest
}

function remoteVideosAdd (req, res, next) {
  req.checkBody('data').isArray()
  req.checkBody('data').isEachAddRemoteVideosValid()

  logger.debug('Checking remoteVideosAdd parameters', { parameters: req.body })

  checkErrors(req, res, next)
}

function remoteVideosRemove (req, res, next) {
  req.checkBody('data').isArray()
  req.checkBody('data').isEachRemoveRemoteVideosValid()

  logger.debug('Checking remoteVideosRemove parameters', { parameters: req.body })

  checkErrors(req, res, next)
}

function secureRequest (req, res, next) {
  req.checkBody('signature.url', 'Should have a signature url').isURL()
  req.checkBody('signature.signature', 'Should have a signature').notEmpty()
  req.checkBody('key', 'Should have a key').notEmpty()
  req.checkBody('data', 'Should have data').notEmpty()

  logger.debug('Checking secureRequest parameters', { parameters: { data: req.body.data, keyLength: req.body.key.length } })

  checkErrors(req, res, next)
}

// ---------------------------------------------------------------------------

module.exports = reqValidatorsRemote
