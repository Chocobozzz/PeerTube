import * as Bluebird from 'bluebird'
import { createWriteStream } from 'fs'
import * as request from 'request'
import { ACTIVITY_PUB } from '../initializers'

function doRequest (
  requestOptions: request.CoreOptions & request.UriOptions & { activityPub?: boolean }
): Bluebird<{ response: request.RequestResponse, body: any }> {
  if (requestOptions.activityPub === true) {
    if (!Array.isArray(requestOptions.headers)) requestOptions.headers = {}
    requestOptions.headers['accept'] = ACTIVITY_PUB.ACCEPT_HEADER
  }

  return new Bluebird<{ response: request.RequestResponse, body: any }>((res, rej) => {
    request(requestOptions, (err, response, body) => err ? rej(err) : res({ response, body }))
  })
}

function doRequestAndSaveToFile (requestOptions: request.CoreOptions & request.UriOptions, destPath: string) {
  return new Bluebird<request.RequestResponse>((res, rej) => {
    request(requestOptions)
      .on('response', response => res(response as request.RequestResponse))
      .on('error', err => rej(err))
      .pipe(createWriteStream(destPath))
  })
}

// ---------------------------------------------------------------------------

export {
  doRequest,
  doRequestAndSaveToFile
}
