;(function () {
  'use strict'

  var async = require('async')
  var config = require('config')
  var request = require('request')
  var replay = require('request-replay')

  var constants = require('../initializers/constants')
  var logger = require('./logger')
  var peertubeCrypto = require('./peertubeCrypto')

  var http = config.get('webserver.https') ? 'https' : 'http'
  var host = config.get('webserver.host')
  var port = config.get('webserver.port')

  var requests = {
    makeMultipleRetryRequest: makeMultipleRetryRequest
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
      signature = peertubeCrypto.sign(url)
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
          // TODO: ES6 with let
          ;(function (copy_params, copy_url, copy_pod, copy_signature) {
            peertubeCrypto.encrypt(pod.publicKey, JSON.stringify(all_data.data), function (err, encrypted) {
              if (err) return callback(err)

              copy_params.json = {
                data: encrypted.data,
                key: encrypted.key
              }

              makeRetryRequest(copy_params, copy_url, copy_pod, copy_signature, callbackEachRetryRequest)
            })
          })(params, url, pod, signature)
        } else {
          params.json = { data: all_data.data }
          makeRetryRequest(params, url, pod, signature, callbackEachRetryRequest)
        }
      } else {
        makeRetryRequest(params, url, pod, signature, callbackEachRetryRequest)
      }
    }, callback)
  }

  // ---------------------------------------------------------------------------

  module.exports = requests

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
