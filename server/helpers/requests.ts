import replay = require('request-replay')
import request = require('request')

import {
  RETRY_REQUESTS,
  REMOTE_SCHEME,
  CONFIG
} from '../initializers'
import { sign } from './peertube-crypto'

function makeRetryRequest (params, callback) {
  replay(
    request(params, callback),
    {
      retries: RETRY_REQUESTS,
      factor: 3,
      maxTimeout: Infinity,
      errorCodes: [ 'EADDRINFO', 'ETIMEDOUT', 'ECONNRESET', 'ESOCKETTIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED' ]
    }
  )
}

function makeSecureRequest (params, callback) {
  const requestParams = {
    url: REMOTE_SCHEME.HTTP + '://' + params.toPod.host + params.path,
    json: {}
  }

  if (params.method !== 'POST') {
    return callback(new Error('Cannot make a secure request with a non POST method.'))
  }

  // Add signature if it is specified in the params
  if (params.sign === true) {
    const host = CONFIG.WEBSERVER.HOST

    let dataToSign
    if (params.data) {
      dataToSign = params.data
    } else {
      // We do not have data to sign so we just take our host
      // It is not ideal but the connection should be in HTTPS
      dataToSign = host
    }

    requestParams.json['signature'] = {
      host, // Which host we pretend to be
      signature: sign(dataToSign)
    }
  }

  // If there are data informations
  if (params.data) {
    requestParams.json['data'] = params.data
  }

  request.post(requestParams, callback)
}

// ---------------------------------------------------------------------------

export {
  makeRetryRequest,
  makeSecureRequest
}
