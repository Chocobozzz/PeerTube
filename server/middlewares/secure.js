'use strict'

const logger = require('../helpers/logger')
const mongoose = require('mongoose')
const peertubeCrypto = require('../helpers/peertube-crypto')

const Pod = mongoose.model('Pod')

const secureMiddleware = {
  checkSignature
}

function checkSignature (req, res, next) {
  const host = req.body.signature.host
  Pod.loadByHost(host, function (err, pod) {
    if (err) {
      logger.error('Cannot get signed host in body.', { error: err })
      return res.sendStatus(500)
    }

    if (pod === null) {
      logger.error('Unknown pod %s.', host)
      return res.sendStatus(403)
    }

    logger.debug('Checking signature from %s.', host)

    const signatureOk = peertubeCrypto.checkSignature(pod.publicKey, host, req.body.signature.signature)

    if (signatureOk === true) {
      return next()
    }

    logger.error('Signature is not okay in body for %s.', req.body.signature.host)
    return res.sendStatus(403)
  })
}

// ---------------------------------------------------------------------------

module.exports = secureMiddleware
