;(function () {
  'use strict'

  var ursa = require('ursa')
  var fs = require('fs')

  var logger = require('../src/logger')
  var utils = require('../src/utils')
  var PodsDB = require('../src/database').PodsDB

  var middleware = {}

  middleware.cache = function (cache) {
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

  middleware.decryptBody = function (req, res, next) {
    logger.debug('Decrypting body.')

    PodsDB.findOne({ url: req.body.signature.url }, function (err, pod) {
      if (err) {
        logger.error('Cannot get signed url in decryptBody.', { error: err })
        res.sendStatus(500)
      }

      logger.debug('Found one pod which could send the message.', { pod: pod.publicKey, url: req.body.signature.url })

      var crt = ursa.createPublicKey(pod.publicKey)
      var signature_ok = crt.hashAndVerify('sha256', new Buffer(req.body.signature.url).toString('hex'), req.body.signature.signature, 'hex')

      if (signature_ok === true) {
        var myKey = ursa.createPrivateKey(fs.readFileSync(utils.certDir + 'petube.key.pem'))
        var decryptedKey = myKey.decrypt(req.body.key, 'hex', 'utf8')
        logger.debug(decryptedKey)
        req.body.data = JSON.parse(utils.symetricDecrypt(req.body.data, decryptedKey))
        logger.debug('Decrypted.', { body: req.body })
      } else {
        logger.error('Signature is not okay in decryptBody for %s.', req.body.signature.url)
        res.sendStatus(500)
      }

      next()
    })
  }

  module.exports = middleware
})()
