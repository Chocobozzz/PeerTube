import * as replay from 'request-replay'
import * as request from 'request'
import * as Promise from 'bluebird'

import {
  RETRY_REQUESTS,
  REMOTE_SCHEME,
  CONFIG
} from '../initializers'
import { PodInstance } from '../models'
import { PodSignature } from '../../shared'
import { signObject } from './peertube-crypto'
import { createWriteStream } from 'fs'

function doRequest (requestOptions: request.CoreOptions & request.UriOptions) {
  return new Promise<{ response: request.RequestResponse, body: any }>((res, rej) => {
    request(requestOptions, (err, response, body) => err ? rej(err) : res({ response, body }))
  })
}

function doRequestAndSaveToFile (requestOptions: request.CoreOptions & request.UriOptions, destPath: string) {
  return new Promise<request.RequestResponse>((res, rej) => {
    request(requestOptions)
      .on('response', response => res(response as request.RequestResponse))
      .on('error', err => rej(err))
      .pipe(createWriteStream(destPath))
  })
}

type MakeRetryRequestParams = {
  url: string,
  method: 'GET' | 'POST',
  json: Object
}
function makeRetryRequest (params: MakeRetryRequestParams) {
  return new Promise<{ response: request.RequestResponse, body: any }>((res, rej) => {
    replay(
      request(params, (err, response, body) => err ? rej(err) : res({ response, body })),
      {
        retries: RETRY_REQUESTS,
        factor: 3,
        maxTimeout: Infinity,
        errorCodes: [ 'EADDRINFO', 'ETIMEDOUT', 'ECONNRESET', 'ESOCKETTIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED' ]
      }
    )
  })
}

type MakeSecureRequestParams = {
  toPod: PodInstance
  path: string
  data?: Object
}
function makeSecureRequest (params: MakeSecureRequestParams) {
  const requestParams: {
    method: 'POST',
    uri: string,
    json: {
      signature: PodSignature,
      data: any
    }
  } = {
    method: 'POST',
    uri: REMOTE_SCHEME.HTTP + '://' + params.toPod.host + params.path,
    json: {
      signature: null,
      data: null
    }
  }

  const host = CONFIG.WEBSERVER.HOST

  let dataToSign
  if (params.data) {
    dataToSign = params.data
  } else {
    // We do not have data to sign so we just take our host
    // It is not ideal but the connection should be in HTTPS
    dataToSign = host
  }

  sign(dataToSign).then(signature => {
    requestParams.json.signature = {
      host, // Which host we pretend to be
      signature
    }

    // If there are data information
    if (params.data) {
      requestParams.json.data = params.data
    }

    return doRequest(requestParams)
  })
}

// ---------------------------------------------------------------------------

export {
  doRequest,
  doRequestAndSaveToFile,
  makeRetryRequest,
  makeSecureRequest
}
