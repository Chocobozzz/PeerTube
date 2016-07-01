'use strict'

const logger = require('../helpers/logger')
const mongoose = require('mongoose')
const peertubeCrypto = require('../helpers/peertube-crypto')

const Pod = mongoose.model('Pod')

const secureMiddleware = {
  decryptBody: decryptBody
}

function decryptBody (req, res, next) {
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
      peertubeCrypto.decrypt(req.body.key, req.body.data, function (err, decrypted) {
        if (err) {
          logger.error('Cannot decrypt data.', { error: err })
          return res.sendStatus(500)
        }

        req.body.data = JSON.parse(decrypted)
        delete req.body.key

        next()
      })
    } else {
      logger.error('Signature is not okay in decryptBody for %s.', req.body.signature.url)
      return res.sendStatus(403)
    }
  })
}

// ---------------------------------------------------------------------------

module.exports = secureMiddleware
