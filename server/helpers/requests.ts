import * as Bluebird from 'bluebird'
import { createWriteStream, remove } from 'fs-extra'
import * as request from 'request'
import { ACTIVITY_PUB, PEERTUBE_VERSION, WEBSERVER } from '../initializers/constants'
import { processImage } from './image-utils'
import { join } from 'path'
import { logger } from './logger'
import { CONFIG } from '../initializers/config'

function doRequest <T> (
  requestOptions: request.CoreOptions & request.UriOptions & { activityPub?: boolean },
  bodyKBLimit = 1000 // 1MB
): Bluebird<{ response: request.RequestResponse, body: T }> {
  if (!(requestOptions.headers)) requestOptions.headers = {}
  requestOptions.headers['User-Agent'] = getUserAgent()

  if (requestOptions.activityPub === true) {
    requestOptions.headers['accept'] = ACTIVITY_PUB.ACCEPT_HEADER
  }

  return new Bluebird<{ response: request.RequestResponse, body: T }>((res, rej) => {
    request(requestOptions, (err, response, body) => err ? rej(err) : res({ response, body }))
      .on('data', onRequestDataLengthCheck(bodyKBLimit))
  })
}

function doRequestAndSaveToFile (
  requestOptions: request.CoreOptions & request.UriOptions,
  destPath: string,
  bodyKBLimit = 10000 // 10MB
) {
  if (!requestOptions.headers) requestOptions.headers = {}
  requestOptions.headers['User-Agent'] = getUserAgent()

  return new Bluebird<void>((res, rej) => {
    const file = createWriteStream(destPath)
    file.on('finish', () => res())

    request(requestOptions)
      .on('data', onRequestDataLengthCheck(bodyKBLimit))
      .on('error', err => {
        file.close()

        remove(destPath)
          .catch(err => logger.error('Cannot remove %s after request failure.', destPath, { err }))

        return rej(err)
      })
      .pipe(file)
  })
}

async function downloadImage (url: string, destDir: string, destName: string, size: { width: number, height: number }) {
  const tmpPath = join(CONFIG.STORAGE.TMP_DIR, 'pending-' + destName)
  await doRequestAndSaveToFile({ method: 'GET', uri: url }, tmpPath)

  const destPath = join(destDir, destName)

  try {
    await processImage(tmpPath, destPath, size)
  } catch (err) {
    await remove(tmpPath)

    throw err
  }
}

function getUserAgent () {
  return `PeerTube/${PEERTUBE_VERSION} (+${WEBSERVER.URL})`
}

// ---------------------------------------------------------------------------

export {
  doRequest,
  doRequestAndSaveToFile,
  downloadImage
}

// ---------------------------------------------------------------------------

// Thanks to https://github.com/request/request/issues/2470#issuecomment-268929907 <3
function onRequestDataLengthCheck (bodyKBLimit: number) {
  let bufferLength = 0
  const bytesLimit = bodyKBLimit * 1000

  return function (chunk) {
    bufferLength += chunk.length
    if (bufferLength > bytesLimit) {
      this.abort()

      const error = new Error(`Response was too large - aborted after ${bytesLimit} bytes.`)
      this.emit('error', error)
    }
  }
}
