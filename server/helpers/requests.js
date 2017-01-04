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

  if (params.method !== 'POST') {
    return callback(new Error('Cannot make a secure request with a non POST method.'))
  }

  requestParams.json = {}

  // Add signature if it is specified in the params
  if (params.sign === true) {
    const host = constants.CONFIG.WEBSERVER.HOST

    let dataToSign
    if (params.data) {
      dataToSign = dataToSign = params.data
    } else {
      // We do not have data to sign so we just take our host
      // It is not ideal but the connection should be in HTTPS
      dataToSign = host
    }

    requestParams.json.signature = {
      host, // Which host we pretend to be
      signature: peertubeCrypto.sign(dataToSign)
    }
  }

  // If there are data informations
  if (params.data) {
    requestParams.json.data = params.data
  }

  request.post(requestParams, callback)
}

// ---------------------------------------------------------------------------

module.exports = requests
