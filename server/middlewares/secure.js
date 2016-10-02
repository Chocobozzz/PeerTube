'use strict'

const logger = require('../helpers/logger')
const mongoose = require('mongoose')
const peertubeCrypto = require('../helpers/peertube-crypto')

const Pod = mongoose.model('Pod')

const secureMiddleware = {
  checkSignature,
  decryptBody
}

function checkSignature (req, res, next) {
  const url = req.body.signature.url
  Pod.loadByUrl(url, function (err, pod) {
    if (err) {
      logger.error('Cannot get signed url in decryptBody.', { error: err })
      return res.sendStatus(500)
    }

    if (pod === null) {
      logger.error('Unknown pod %s.', url)
      return res.sendStatus(403)
    }

    logger.debug('Decrypting body from %s.', url)

    const signatureOk = peertubeCrypto.checkSignature(pod.publicKey, url, req.body.signature.signature)

    if (signatureOk === true) {
      return next()
    }

    logger.error('Signature is not okay in decryptBody for %s.', req.body.signature.url)
    return res.sendStatus(403)
  })
}

function decryptBody (req, res, next) {
  peertubeCrypto.decrypt(req.body.key, req.body.data, function (err, decrypted) {
    if (err) {
      logger.error('Cannot decrypt data.', { error: err })
      return res.sendStatus(500)
    }

    try {
      req.body.data = JSON.parse(decrypted)
      delete req.body.key
    } catch (err) {
      logger.error('Error in JSON.parse', { error: err })
      return res.sendStatus(500)
    }

    next()
  })
}

// ---------------------------------------------------------------------------

module.exports = secureMiddleware
