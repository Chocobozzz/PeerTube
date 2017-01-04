'use strict'

const checkErrors = require('../utils').checkErrors
const logger = require('../../../helpers/logger')

const validatorsRemoteSignature = {
  signature
}

function signature (req, res, next) {
  req.checkBody('signature.host', 'Should have a signature host').isURL()
  req.checkBody('signature.signature', 'Should have a signature').notEmpty()

  logger.debug('Checking signature parameters', { parameters: { signatureHost: req.body.signature.host } })

  checkErrors(req, res, next)
}

// ---------------------------------------------------------------------------

module.exports = validatorsRemoteSignature
