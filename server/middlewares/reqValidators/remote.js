'use strict'

const checkErrors = require('./utils').checkErrors
const logger = require('../../helpers/logger')

const reqValidatorsRemote = {
  dataToDecrypt: dataToDecrypt,
  remoteVideos: remoteVideos,
  signature: signature
}

function dataToDecrypt (req, res, next) {
  req.checkBody('key', 'Should have a key').notEmpty()
  req.checkBody('data', 'Should have data').notEmpty()

  logger.debug('Checking dataToDecrypt parameters', { parameters: { keyLength: req.body.key.length, bodyLength: req.body.data.length } })

  checkErrors(req, res, next)
}

function remoteVideos (req, res, next) {
  req.checkBody('data').isArray()
  req.checkBody('data').isEachRemoteVideosValid()

  logger.debug('Checking remoteVideos parameters', { parameters: req.body })

  checkErrors(req, res, next)
}

function signature (req, res, next) {
  req.checkBody('signature.url', 'Should have a signature url').isURL()
  req.checkBody('signature.signature', 'Should have a signature').notEmpty()

  logger.debug('Checking signature parameters', { parameters: { signatureUrl: req.body.signature.url } })

  checkErrors(req, res, next)
}

// ---------------------------------------------------------------------------

module.exports = reqValidatorsRemote
