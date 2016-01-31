;(function () {
  'use strict'

  var async = require('async')
  var config = require('config')
  var crypto = require('crypto')
  var fs = require('fs')
  var openssl = require('openssl-wrapper')
  var request = require('request')
  var replay = require('request-replay')
  var ursa = require('ursa')

  var constants = require('../initializers/constants')
  var logger = require('./logger')

  var certDir = __dirname + '/../' + config.get('storage.certs')
  var http = config.get('webserver.https') ? 'https' : 'http'
  var host = config.get('webserver.host')
  var port = config.get('webserver.port')
  var algorithm = 'aes-256-ctr'

  var utils = {
    getCertDir: getCertDir,
    certsExist: certsExist,
    cleanForExit: cleanForExit,
    createCerts: createCerts,
    createCertsIfNotExist: createCertsIfNotExist,
    generatePassword: generatePassword,
    makeMultipleRetryRequest: makeMultipleRetryRequest,
    symetricEncrypt: symetricEncrypt,
    symetricDecrypt: symetricDecrypt
  }

  function getCertDir () {
    return certDir
  }

  function makeMultipleRetryRequest (all_data, pods, callbackEach, callback) {
    if (!callback) {
      callback = callbackEach
      callbackEach = null
    }

    var url = http + '://' + host + ':' + port
    var signature

    // Add signature if it is specified in the params
    if (all_data.method === 'POST' && all_data.data && all_data.sign === true) {
      var myKey = ursa.createPrivateKey(fs.readFileSync(certDir + 'peertube.key.pem'))
      signature = myKey.hashAndSign('sha256', url, 'utf8', 'hex')
    }

    // Make a request for each pod
    async.each(pods, function (pod, callback_each_async) {
      function callbackEachRetryRequest (err, response, body, url, pod) {
        if (callbackEach !== null) {
          callbackEach(err, response, body, url, pod, function () {
            callback_each_async()
          })
        } else {
          callback_each_async()
        }
      }

      var params = {
        url: pod.url + all_data.path,
        method: all_data.method
      }

      // Add data with POST requst ?
      if (all_data.method === 'POST' && all_data.data) {
        // Encrypt data ?
        if (all_data.encrypt === true) {
          var crt = ursa.createPublicKey(pod.publicKey)

          // TODO: ES6 with let
          ;(function (crt_copy, copy_params, copy_url, copy_pod, copy_signature) {
            symetricEncrypt(JSON.stringify(all_data.data), function (err, dataEncrypted) {
              if (err) throw err

              var passwordEncrypted = crt_copy.encrypt(dataEncrypted.password, 'utf8', 'hex')
              copy_params.json = {
                data: dataEncrypted.crypted,
                key: passwordEncrypted
              }

              makeRetryRequest(copy_params, copy_url, copy_pod, copy_signature, callbackEachRetryRequest)
            })
          })(crt, params, url, pod, signature)
        } else {
          params.json = { data: all_data.data }
          makeRetryRequest(params, url, pod, signature, callbackEachRetryRequest)
        }
      } else {
        makeRetryRequest(params, url, pod, signature, callbackEachRetryRequest)
      }
    }, callback)
  }

  function certsExist (callback) {
    fs.exists(certDir + 'peertube.key.pem', function (exists) {
      return callback(exists)
    })
  }

  function createCerts (callback) {
    certsExist(function (exist) {
      if (exist === true) {
        var string = 'Certs already exist.'
        logger.warning(string)
        return callback(new Error(string))
      }

      logger.info('Generating a RSA key...')
      openssl.exec('genrsa', { 'out': certDir + 'peertube.key.pem', '2048': false }, function (err) {
        if (err) {
          logger.error('Cannot create private key on this pod.', { error: err })
          return callback(err)
        }
        logger.info('RSA key generated.')

        logger.info('Manage public key...')
        openssl.exec('rsa', { 'in': certDir + 'peertube.key.pem', 'pubout': true, 'out': certDir + 'peertube.pub' }, function (err) {
          if (err) {
            logger.error('Cannot create public key on this pod .', { error: err })
            return callback(err)
          }

          logger.info('Public key managed.')
          return callback(null)
        })
      })
    })
  }

  function createCertsIfNotExist (callback) {
    certsExist(function (exist) {
      if (exist === true) {
        return callback(null)
      }

      createCerts(function (err) {
        return callback(err)
      })
    })
  }

  function generatePassword (callback) {
    crypto.randomBytes(32, function (err, buf) {
      if (err) {
        return callback(err)
      }

      callback(null, buf.toString('utf8'))
    })
  }

  function symetricEncrypt (text, callback) {
    generatePassword(function (err, password) {
      if (err) {
        return callback(err)
      }

      var cipher = crypto.createCipher(algorithm, password)
      var crypted = cipher.update(text, 'utf8', 'hex')
      crypted += cipher.final('hex')
      callback(null, { crypted: crypted, password: password })
    })
  }

  function symetricDecrypt (text, password) {
    var decipher = crypto.createDecipher(algorithm, password)
    var dec = decipher.update(text, 'hex', 'utf8')
    dec += decipher.final('utf8')
    return dec
  }

  function cleanForExit (webtorrent_process) {
    logger.info('Gracefully exiting')
    process.kill(-webtorrent_process.pid)
  }

  // ---------------------------------------------------------------------------

  module.exports = utils

  // ---------------------------------------------------------------------------

  function makeRetryRequest (params, from_url, to_pod, signature, callbackEach) {
    // Append the signature
    if (signature) {
      params.json.signature = {
        url: from_url,
        signature: signature
      }
    }

    logger.debug('Make retry requests to %s.', to_pod.url)

    replay(
      request.post(params, function (err, response, body) {
        callbackEach(err, response, body, params.url, to_pod)
      }),
      {
        retries: constants.REQUEST_RETRIES,
        factor: 3,
        maxTimeout: Infinity,
        errorCodes: [ 'EADDRINFO', 'ETIMEDOUT', 'ECONNRESET', 'ESOCKETTIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED' ]
      }
    ).on('replay', function (replay) {
      logger.info('Replaying request to %s. Request failed: %d %s. Replay number: #%d. Will retry in: %d ms.',
        params.url, replay.error.code, replay.error.message, replay.number, replay.delay)
    })
  }
})()
