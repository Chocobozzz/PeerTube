import { createWriteStream, remove } from 'fs-extra'
import got, { CancelableRequest, Options as GotOptions, RequestError } from 'got'
import { join } from 'path'
import { CONFIG } from '../initializers/config'
import { ACTIVITY_PUB, PEERTUBE_VERSION, REQUEST_TIMEOUT, WEBSERVER } from '../initializers/constants'
import { pipelinePromise } from './core-utils'
import { processImage } from './image-utils'
import { logger } from './logger'

export interface PeerTubeRequestError extends Error {
  statusCode?: number
  responseBody?: any
}

const httpSignature = require('http-signature')

type PeerTubeRequestOptions = {
  activityPub?: boolean
  bodyKBLimit?: number // 1MB
  httpSignature?: {
    algorithm: string
    authorizationHeaderName: string
    keyId: string
    key: string
    headers: string[]
  }
  timeout?: number
  jsonResponse?: boolean
} & Pick<GotOptions, 'headers' | 'json' | 'method' | 'searchParams'>

const peertubeGot = got.extend({
  headers: {
    'user-agent': getUserAgent()
  },

  handlers: [
    (options, next) => {
      const promiseOrStream = next(options) as CancelableRequest<any>
      const bodyKBLimit = options.context?.bodyKBLimit as number
      if (!bodyKBLimit) throw new Error('No KB limit for this request')

      const bodyLimit = bodyKBLimit * 1000

      /* eslint-disable @typescript-eslint/no-floating-promises */
      promiseOrStream.on('downloadProgress', progress => {
        if (progress.transferred > bodyLimit && progress.percent !== 1) {
          const message = `Exceeded the download limit of ${bodyLimit} B`
          logger.warn(message)

          // CancelableRequest
          if (promiseOrStream.cancel) {
            promiseOrStream.cancel()
            return
          }

          // Stream
          (promiseOrStream as any).destroy()
        }
      })

      return promiseOrStream
    }
  ],

  hooks: {
    beforeRequest: [
      options => {
        const headers = options.headers || {}
        headers['host'] = options.url.host
      },

      options => {
        const httpSignatureOptions = options.context?.httpSignature

        if (httpSignatureOptions) {
          const method = options.method ?? 'GET'
          const path = options.path ?? options.url.pathname

          if (!method || !path) {
            throw new Error(`Cannot sign request without method (${method}) or path (${path}) ${options}`)
          }

          httpSignature.signRequest({
            getHeader: function (header) {
              return options.headers[header]
            },

            setHeader: function (header, value) {
              options.headers[header] = value
            },

            method,
            path
          }, httpSignatureOptions)
        }
      },

      (options: GotOptions) => {
        options.timeout = REQUEST_TIMEOUT
      }
    ]
  }
})

function doRequest (url: string, options: PeerTubeRequestOptions = {}) {
  const gotOptions = buildGotOptions(options)

  return peertubeGot(url, gotOptions)
    .catch(err => { throw buildRequestError(err) })
}

function doJSONRequest <T> (url: string, options: PeerTubeRequestOptions = {}) {
  const gotOptions = buildGotOptions(options)

  return peertubeGot<T>(url, { ...gotOptions, responseType: 'json' })
    .catch(err => { throw buildRequestError(err) })
}

async function doRequestAndSaveToFile (
  url: string,
  destPath: string,
  options: PeerTubeRequestOptions = {}
) {
  const gotOptions = buildGotOptions(options)

  const outFile = createWriteStream(destPath)

  try {
    await pipelinePromise(
      peertubeGot.stream(url, gotOptions),
      outFile
    )
  } catch (err) {
    remove(destPath)
      .catch(err => logger.error('Cannot remove %s after request failure.', destPath, { err }))

    throw buildRequestError(err)
  }
}

async function downloadImage (url: string, destDir: string, destName: string, size: { width: number, height: number }) {
  const tmpPath = join(CONFIG.STORAGE.TMP_DIR, 'pending-' + destName)
  await doRequestAndSaveToFile(url, tmpPath)

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
  doJSONRequest,
  doRequestAndSaveToFile,
  downloadImage
}

// ---------------------------------------------------------------------------

function buildGotOptions (options: PeerTubeRequestOptions) {
  const { activityPub, bodyKBLimit = 1000 } = options

  const context = { bodyKBLimit, httpSignature: options.httpSignature }

  let headers = options.headers || {}

  if (!headers.date) {
    headers = { ...headers, date: new Date().toUTCString() }
  }

  if (activityPub && !headers.accept) {
    headers = { ...headers, accept: ACTIVITY_PUB.ACCEPT_HEADER }
  }

  return {
    method: options.method,
    dnsCache: true,
    json: options.json,
    searchParams: options.searchParams,
    timeout: options.timeout ?? REQUEST_TIMEOUT,
    headers,
    context
  }
}

function buildRequestError (error: RequestError) {
  const newError: PeerTubeRequestError = new Error(error.message)
  newError.name = error.name
  newError.stack = error.stack

  if (error.response) {
    newError.responseBody = error.response.body
    newError.statusCode = error.response.statusCode
  }

  return newError
}
