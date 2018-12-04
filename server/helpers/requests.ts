import * as Bluebird from 'bluebird'
import { createWriteStream } from 'fs-extra'
import * as request from 'request'
import { ACTIVITY_PUB, CONFIG } from '../initializers'
import { processImage } from './image-utils'
import { join } from 'path'

function doRequest <T> (
  requestOptions: request.CoreOptions & request.UriOptions & { activityPub?: boolean }
): Bluebird<{ response: request.RequestResponse, body: any }> {
  if (requestOptions.activityPub === true) {
    if (!Array.isArray(requestOptions.headers)) requestOptions.headers = {}
    requestOptions.headers['accept'] = ACTIVITY_PUB.ACCEPT_HEADER
  }

  return new Bluebird<{ response: request.RequestResponse, body: T }>((res, rej) => {
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

async function downloadImage (url: string, destDir: string, destName: string, size: { width: number, height: number }) {
  const tmpPath = join(CONFIG.STORAGE.TMP_DIR, 'pending-' + destName)
  await doRequestAndSaveToFile({ method: 'GET', uri: url }, tmpPath)

  const destPath = join(destDir, destName)
  await processImage({ path: tmpPath }, destPath, size)
}

// ---------------------------------------------------------------------------

export {
  doRequest,
  doRequestAndSaveToFile,
  downloadImage
}
