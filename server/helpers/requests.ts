import * as Bluebird from 'bluebird'
import { createWriteStream } from 'fs-extra'
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
  return new Bluebird<void>((res, rej) => {
    const file = createWriteStream(destPath)
    file.on('finish', () => res())

    request(requestOptions)
      .on('error', err => rej(err))
      .pipe(file)
  })
}

// ---------------------------------------------------------------------------

export {
  doRequest,
  doRequestAndSaveToFile
}
