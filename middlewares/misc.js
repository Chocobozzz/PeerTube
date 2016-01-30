;(function () {
  'use strict'

  var ursa = require('ursa')
  var fs = require('fs')

  var logger = require('../helpers/logger')
  var utils = require('../helpers/utils')
  var PodsDB = require('../initializers/database').PodsDB

  var misc = {}

  misc.cache = function (cache) {
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

  misc.decryptBody = function (req, res, next) {
    PodsDB.findOne({ url: req.body.signature.url }, function (err, pod) {
      if (err) {
        logger.error('Cannot get signed url in decryptBody.', { error: err })
        return res.sendStatus(500)
      }

      if (pod === null) {
        logger.error('Unknown pod %s.', req.body.signature.url)
        return res.sendStatus(403)
      }

      logger.debug('Decrypting body from %s.', req.body.signature.url)

      var crt = ursa.createPublicKey(pod.publicKey)
      var signature_ok = crt.hashAndVerify('sha256', new Buffer(req.body.signature.url).toString('hex'), req.body.signature.signature, 'hex')

      if (signature_ok === true) {
        var myKey = ursa.createPrivateKey(fs.readFileSync(utils.certDir + 'peertube.key.pem'))
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

  module.exports = misc
})()
