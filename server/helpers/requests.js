'use strict'

const replay = require('request-replay')
const request = require('request')

const constants = require('../initializers/constants')
const peertubeCrypto = require('./peertube-crypto')

const requests = {
  makeRetryRequest,
  makeSecureRequest
}

function makeRetryRequest (params, callback) {
  replay(
    request(params, callback),
    {
      retries: constants.RETRY_REQUESTS,
      factor: 3,
      maxTimeout: Infinity,
      errorCodes: [ 'EADDRINFO', 'ETIMEDOUT', 'ECONNRESET', 'ESOCKETTIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED' ]
    }
  )
}

function makeSecureRequest (params, callback) {
  const requestParams = {
    url: constants.REMOTE_SCHEME.HTTP + '://' + params.toPod.host + params.path
  }

  // Add data with POST requst ?
  if (params.method === 'POST') {
    requestParams.json = {}

    // Add signature if it is specified in the params
    if (params.sign === true) {
      const host = constants.CONFIG.WEBSERVER.HOST

      requestParams.json.signature = {
        host,
        signature: peertubeCrypto.sign(host)
      }
    }

    // If there are data informations
    if (params.data) {
      // Encrypt data
      if (params.encrypt === true) {
        peertubeCrypto.encrypt(params.toPod.publicKey, JSON.stringify(params.data), function (err, encrypted) {
          if (err) return callback(err)

          requestParams.json.data = encrypted.data
          requestParams.json.key = encrypted.key

          request.post(requestParams, callback)
        })
      } else {
        // No encryption
        requestParams.json.data = params.data
        request.post(requestParams, callback)
      }
    } else {
      // No data
      request.post(requestParams, callback)
    }
  } else {
    request.get(requestParams, callback)
  }
}

// ---------------------------------------------------------------------------

module.exports = requests
