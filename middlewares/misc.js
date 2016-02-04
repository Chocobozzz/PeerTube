;(function () {
  'use strict'

  var fs = require('fs')
  var ursa = require('ursa')

  var logger = require('../helpers/logger')
  var Pods = require('../models/pods')
  var utils = require('../helpers/utils')

  var miscMiddleware = {
    cache: cache,
    decryptBody: decryptBody
  }

  function cache (cache) {
    return function (req, res, next) {
      // If we want explicitly a cache
      // Or if we don't specify if we want a cache or no and we are in production
      if (cache === true || (cache !== false && process.env.NODE_ENV === 'production')) {
        res.setHeader('Cache-Control', 'public')
      } else {
        res.setHeader('Cache-Control', 'no-cache, no-store, max-age=0, must-revalidate')
      }

      next()
    }
  }

  function decryptBody (req, res, next) {
    var url = req.body.signature.url
    Pods.findByUrl(url, function (err, pod) {
      if (err) {
        logger.error('Cannot get signed url in decryptBody.', { error: err })
        return res.sendStatus(500)
      }

      if (pod === null) {
        logger.error('Unknown pod %s.', url)
        return res.sendStatus(403)
      }

      logger.debug('Decrypting body from %s.', url)

      var crt = ursa.createPublicKey(pod.publicKey)
      var signature_ok = crt.hashAndVerify('sha256', new Buffer(req.body.signature.url).toString('hex'), req.body.signature.signature, 'hex')

      if (signature_ok === true) {
        var myKey = ursa.createPrivateKey(fs.readFileSync(utils.getCertDir() + 'peertube.key.pem'))
        var decryptedKey = myKey.decrypt(req.body.key, 'hex', 'utf8')
        req.body.data = JSON.parse(utils.symetricDecrypt(req.body.data, decryptedKey))
        delete req.body.key
      } else {
        logger.error('Signature is not okay in decryptBody for %s.', req.body.signature.url)
        return res.sendStatus(403)
      }

      next()
    })
  }

  // ---------------------------------------------------------------------------

  module.exports = miscMiddleware
})()
