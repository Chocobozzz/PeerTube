import * as replay from 'request-replay'
import * as request from 'request'

import {
  RETRY_REQUESTS,
  REMOTE_SCHEME,
  CONFIG
} from '../initializers'
import { PodInstance } from '../models'
import { sign } from './peertube-crypto'

type MakeRetryRequestParams = {
  url: string,
  method: 'GET'|'POST',
  json: Object
}
function makeRetryRequest (params: MakeRetryRequestParams, callback: request.RequestCallback) {
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

type MakeSecureRequestParams = {
  method: 'GET'|'POST'
  toPod: PodInstance
  path: string
  sign: boolean
  data?: Object
}
function makeSecureRequest (params: MakeSecureRequestParams, callback: request.RequestCallback) {
  const requestParams = {
    url: REMOTE_SCHEME.HTTP + '://' + params.toPod.host + params.path,
    json: {}
  }

  if (params.method !== 'POST') {
    return callback(new Error('Cannot make a secure request with a non POST method.'), null, null)
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
