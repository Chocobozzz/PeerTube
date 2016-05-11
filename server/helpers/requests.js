'use strict'

const async = require('async')
const config = require('config')
const request = require('request')
const replay = require('request-replay')

const constants = require('../initializers/constants')
const logger = require('./logger')
const peertubeCrypto = require('./peertubeCrypto')

const http = config.get('webserver.https') ? 'https' : 'http'
const host = config.get('webserver.host')
const port = config.get('webserver.port')

const requests = {
  makeMultipleRetryRequest: makeMultipleRetryRequest
}

function makeMultipleRetryRequest (allData, pods, callbackEach, callback) {
  if (!callback) {
    callback = callbackEach
    callbackEach = null
  }

  const url = http + '://' + host + ':' + port
  let signature

  // Add signature if it is specified in the params
  if (allData.method === 'POST' && allData.data && allData.sign === true) {
    signature = peertubeCrypto.sign(url)
  }

  // Make a request for each pod
  async.each(pods, function (pod, callbackEachAsync) {
    function callbackEachRetryRequest (err, response, body, url, pod) {
      if (callbackEach !== null) {
        callbackEach(err, response, body, url, pod, function () {
          callbackEachAsync()
        })
      } else {
        callbackEachAsync()
      }
    }

    const params = {
      url: pod.url + allData.path,
      method: allData.method
    }

    // Add data with POST requst ?
    if (allData.method === 'POST' && allData.data) {
      // Encrypt data ?
      if (allData.encrypt === true) {
        peertubeCrypto.encrypt(pod.publicKey, JSON.stringify(allData.data), function (err, encrypted) {
          if (err) return callback(err)

          params.json = {
            data: encrypted.data,
            key: encrypted.key
          }

          makeRetryRequest(params, url, pod, signature, callbackEachRetryRequest)
        })
      } else {
        params.json = { data: allData.data }
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

function makeRetryRequest (params, fromUrl, toPod, signature, callbackEach) {
  // Append the signature
  if (signature) {
    params.json.signature = {
      url: fromUrl,
      signature: signature
    }
  }

  logger.debug('Make retry requests to %s.', toPod.url)

  replay(
    request.post(params, function (err, response, body) {
      callbackEach(err, response, body, params.url, toPod)
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
