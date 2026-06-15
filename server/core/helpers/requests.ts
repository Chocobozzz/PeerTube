import { signAsDraftToRequest } from '@misskey-dev/node-http-message-signatures'
import { CONFIG } from '@server/initializers/config.js'
import { createWriteStream } from 'fs'
import { remove } from 'fs-extra/esm'
import got, { OptionsInit, OptionsOfTextResponseBody, OptionsOfUnknownResponseBodyWrapped, Request, RequestError, Response } from 'got'
import { gotSsrf } from 'got-ssrf'
import http from 'http'
import https from 'https'
import { HttpProxyAgent, HttpsProxyAgent } from '../helpers/hpagent.js'
import { ACTIVITY_PUB, BINARY_CONTENT_TYPES, PEERTUBE_VERSION, REQUEST_TIMEOUTS, WEBSERVER } from '../initializers/constants.js'
import { pipelinePromise } from './core-utils.js'
import { logger, loggerTagsFactory } from './logger.js'
import { getProxy, isProxyEnabled } from './proxy.js'

const lTags = loggerTagsFactory('request')

export interface PeerTubeRequestError extends Error {
  statusCode?: number

  responseBody?: any
  responseHeaders?: any

  requestHeaders?: any
  requestUrl?: any
  requestMethod?: any
}

export type PeerTubeRequestOptions = {
  timeout?: number
  activityPub?: boolean
  bodyKBLimit?: number // 1MB

  httpSignature?: {
    keyId: string
    key: string
    headers: string[]
  }

  jsonResponse?: boolean

  followRedirect?: boolean

  // Support AbortSignal for request cancellation (e.g., on job timeout)
  signal?: AbortSignal
} & Pick<OptionsInit, 'headers' | 'json' | 'method' | 'searchParams'>

export const unsafeSSRFGot = got.extend({
  ...getProxyAgent(),

  headers: {
    'user-agent': getUserAgent()
  },

  handlers: [
    (options, next) => {
      const bodyKBLimit = options.context?.bodyKBLimit as number
      if (!bodyKBLimit) throw new Error('No KB limit for this request')

      let controller: AbortController
      let { signal } = options

      if (!signal) {
        controller = new AbortController()
        signal = controller.signal
        options.signal = signal
      }

      const promiseOrStream = next(options)
      const bodyLimit = bodyKBLimit * 1000

      void promiseOrStream.on('downloadProgress', progress => {
        if (progress.transferred > bodyLimit && progress.percent !== 1) {
          const message = `Exceeded the download limit of ${bodyLimit} B`
          const error = new Error(message)
          logger.warn(message, lTags())

          if (options.isStream) {
            ;(promiseOrStream as Request).destroy(error)
          } else {
            controller?.abort(error)
          }
        }
      })

      return promiseOrStream
    }
  ],

  hooks: {
    beforeRequest: [
      options => {
        const headers = options.headers || {}
        headers['host'] = buildUrl(options.url).host
      },

      async options => {
        const httpSignatureOptions = options.context?.httpSignature as PeerTubeRequestOptions['httpSignature']

        if (httpSignatureOptions) {
          const method = options.method ?? 'GET'
          const path = buildUrl(options.url).pathname

          if (!method || !path) {
            throw new Error(`Cannot sign request without method (${method}) or path (${path}) ${options}`)
          }

          const request = {
            headers: options.headers,
            method,
            url: path
          }

          await signAsDraftToRequest(
            request,
            {
              keyId: httpSignatureOptions.keyId,
              privateKeyPem: httpSignatureOptions.key
            },
            httpSignatureOptions.headers
          )
        }
      }
    ],

    beforeRetry: [
      (error: RequestError, retryCount: number) => {
        logger.debug('Retrying request to %s.', error.request.requestUrl, { retryCount, error: buildRequestError(error), ...lTags() })
      }
    ]
  }
})

export const peertubeGot = CONFIG.FEDERATION.PREVENT_SSRF
  ? got.extend(gotSsrf, unsafeSSRFGot)
  : unsafeSSRFGot

// ---------------------------------------------------------------------------

export function doRequest (url: string, options: PeerTubeRequestOptions & { preventSSRF?: false } = {}) {
  const gotOptions = buildGotOptions(options) as OptionsOfTextResponseBody

  const gotInstance = options.preventSSRF === false
    ? unsafeSSRFGot
    : peertubeGot

  return gotInstance(url, gotOptions)
    .catch(err => {
      throw buildRequestError(err)
    })
}

export function doJSONRequest<T> (url: string, options: PeerTubeRequestOptions & { preventSSRF?: false } = {}) {
  const gotOptions = buildGotOptions(options)

  const gotInstance = options.preventSSRF === false
    ? unsafeSSRFGot
    : peertubeGot

  return gotInstance<T>(url, { ...gotOptions, responseType: 'json' })
    .catch(err => {
      throw buildRequestError(err)
    })
}

export async function doRequestAndSaveToFile (url: string, destPath: string, options: PeerTubeRequestOptions = {}) {
  const gotOptions = buildGotOptions({ ...options, timeout: options.timeout ?? REQUEST_TIMEOUTS.FILE })

  const outFile = createWriteStream(destPath)

  try {
    await pipelinePromise(
      peertubeGot.stream(url, gotOptions),
      outFile
    )
  } catch (err) {
    remove(destPath)
      .catch(err => logger.error('Cannot remove %s after request failure.', destPath, { err, ...lTags() }))

    throw buildRequestError(err)
  }
}

export function generateRequestStream (url: string, options: PeerTubeRequestOptions = {}) {
  const gotOptions = buildGotOptions({ ...options, timeout: options.timeout ?? REQUEST_TIMEOUTS.DEFAULT })

  return peertubeGot.stream(url, gotOptions)
}

export function getProxyAgent () {
  if (!isProxyEnabled()) {
    return {
      agent: { // Fix issue https://github.com/node-fetch/node-fetch/issues/1735 with Node 20
        http: new http.Agent({ keepAlive: false }),
        https: new https.Agent({ keepAlive: false })
      }
    }
  }

  const proxy = getProxy()

  logger.info('Using proxy %s.', proxy, lTags())

  const proxyAgentOptions = {
    keepAlive: true,
    keepAliveMsecs: 1000,
    maxSockets: 256,
    maxFreeSockets: 256,
    scheduling: 'lifo' as 'lifo',
    proxy
  }

  return {
    agent: {
      http: new HttpProxyAgent(proxyAgentOptions),
      https: new HttpsProxyAgent(proxyAgentOptions)
    }
  }
}

export function isBinaryResponse (result: Response<any>) {
  return BINARY_CONTENT_TYPES.has(result.headers['content-type'])
}

export function buildRequestError (error: RequestError) {
  if (!error.response && !error.options) return error

  const newError: PeerTubeRequestError = new Error(error.message)
  newError.name = error.name
  newError.stack = error.stack

  if (error.response) {
    newError.responseBody = error.response.body
    newError.responseHeaders = error.response.headers
    newError.statusCode = error.response.statusCode
  }

  if (error.options) {
    newError.requestHeaders = error.options.headers
    newError.requestUrl = error.options.url
    newError.requestMethod = error.options.method
  }

  return newError
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

function getUserAgent () {
  return `PeerTube/${PEERTUBE_VERSION} (+${WEBSERVER.URL})`
}

function buildGotOptions (options: PeerTubeRequestOptions): OptionsOfUnknownResponseBodyWrapped {
  const { activityPub, bodyKBLimit = 3000 } = options

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
    resolveBodyOnly: false,
    timeout: {
      request: options.timeout ?? REQUEST_TIMEOUTS.DEFAULT
    },
    json: options.json,
    searchParams: options.searchParams,
    followRedirect: options.followRedirect,
    signal: options.signal,
    retry: {
      limit: 2
    },
    headers,
    context
  }
}

function buildUrl (url: string | URL) {
  if (typeof url === 'string') {
    return new URL(url)
  }

  return url
}
