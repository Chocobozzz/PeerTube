;(function () {
  'use strict'

  var request = require('request')
  var replay = require('request-replay')
  var ursa = require('ursa')
  var config = require('config')
  var fs = require('fs')
  var openssl = require('openssl-wrapper')
  var crypto = require('crypto')

  var logger = require('./logger')

  var http = config.get('webserver.https') ? 'https' : 'http'
  var host = config.get('webserver.host')
  var port = config.get('webserver.port')
  var algorithm = 'aes-256-ctr'

  var utils = {}

  // ----------- Private functions ----------

  function makeRetryRequest (params, from_url, to_pod, signature, callbackEach) {
    // Append the signature
    if (signature) {
      params.json.signature = {
        url: from_url,
        signature: signature
      }
    }

    logger.debug('Sending informations to %s', to_pod.url, { params: params })

    // Replay 15 times, with factor 3
    replay(
      request.post(params, function (err, response, body) {
        callbackEach(err, response, body, to_pod.url)
      }),
      {
        retries: 10,
        factor: 3,
        maxTimeout: Infinity,
        errorCodes: [ 'EADDRINFO', 'ETIMEDOUT', 'ECONNRESET', 'ESOCKETTIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED' ]
      }
    ).on('replay', function (replay) {
      logger.info('Replaying request to %s. Request failed: %d %s. Replay number: #%d. Will retry in: %d ms.',
        params.url, replay.error.code, replay.error.message, replay.number, replay.delay)
    })
  }

  // ----------- Public attributes ----------
  utils.certDir = __dirname + '/../' + config.get('storage.certs')

  // { path, data }
  utils.makeMultipleRetryRequest = function (all, pods, callbackEach, callback) {
    if (!callback) {
      callback = callbackEach
      callbackEach = function () {}
    }

    var url = http + '://' + host + ':' + port
    var signature

    // Signature ?
    if (all.method === 'POST' && all.data && all.sign === true) {
      var myKey = ursa.createPrivateKey(fs.readFileSync(utils.certDir + 'peertube.key.pem'))
      signature = myKey.hashAndSign('sha256', url, 'utf8', 'hex')
    }

    // Make a request for each pod
    for (var pod of pods) {
      var params = {
        url: pod.url + all.path,
        method: all.method
      }

      // Add data with POST requst ?
      if (all.method === 'POST' && all.data) {
        logger.debug('Make a POST request.')

        // Encrypt data ?
        if (all.encrypt === true) {
          logger.debug(pod.publicKey)
          var crt = ursa.createPublicKey(pod.publicKey)

          // TODO: ES6 with let
          ;(function (crt_copy, copy_params, copy_url, copy_pod, copy_signature) {
            utils.symetricEncrypt(JSON.stringify(all.data), function (err, dataEncrypted) {
              if (err) throw err

              var passwordEncrypted = crt_copy.encrypt(dataEncrypted.password, 'utf8', 'hex')
              copy_params.json = {
                data: dataEncrypted.crypted,
                key: passwordEncrypted
              }

              makeRetryRequest(copy_params, copy_url, copy_pod, copy_signature, callbackEach)
            })
          })(crt, params, url, pod, signature)
        } else {
          params.json = { data: all.data }
          makeRetryRequest(params, url, pod, signature, callbackEach)
        }
      } else {
        logger.debug('Make a GET/DELETE request')
        makeRetryRequest(params, url, pod, signature, callbackEach)
      }
    }

    return callback()
  }

  utils.certsExist = function (callback) {
    fs.exists(utils.certDir + 'peertube.key.pem', function (exists) {
      return callback(exists)
    })
  }

  utils.createCerts = function (callback) {
    utils.certsExist(function (exist) {
      if (exist === true) {
        var string = 'Certs already exist.'
        logger.warning(string)
        return callback(new Error(string))
      }

      logger.debug('Gen RSA keys...')
      openssl.exec('genrsa', { 'out': utils.certDir + 'peertube.key.pem' }, function (err) {
        if (err) {
          logger.error('Cannot create private key on this pod.', { error: err })
          return callback(err)
        }

        logger.debug('Manage public key...')
        openssl.exec('rsa', { 'in': utils.certDir + 'peertube.key.pem', 'pubout': true, 'out': utils.certDir + 'peertube.pub' }, function (err) {
          if (err) {
            logger.error('Cannot create public key on this pod .', { error: err })
            return callback(err)
          }

          return callback(null)
        })
      })
    })
  }

  utils.createCertsIfNotExist = function (callback) {
    utils.certsExist(function (exist) {
      if (exist === true) {
        return callback(null)
      }

      utils.createCerts(function (err) {
        return callback(err)
      })
    })
  }

  utils.generatePassword = function (callback) {
    crypto.randomBytes(32, function (err, buf) {
      if (err) {
        return callback(err)
      }

      callback(null, buf.toString('utf8'))
    })
  }

  utils.symetricEncrypt = function (text, callback) {
    utils.generatePassword(function (err, password) {
      if (err) {
        return callback(err)
      }

      var cipher = crypto.createCipher(algorithm, password)
      var crypted = cipher.update(text, 'utf8', 'hex')
      crypted += cipher.final('hex')
      callback(null, { crypted: crypted, password: password })
    })
  }

  utils.symetricDecrypt = function (text, password) {
    var decipher = crypto.createDecipher(algorithm, password)
    var dec = decipher.update(text, 'hex', 'utf8')
    dec += decipher.final('utf8')
    return dec
  }

  module.exports = utils
})()
