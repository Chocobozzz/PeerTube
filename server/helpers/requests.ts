import * as Promise from 'bluebird'
import { createWriteStream } from 'fs'
import * as request from 'request'

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

// ---------------------------------------------------------------------------

export {
  doRequest,
  doRequestAndSaveToFile
}
