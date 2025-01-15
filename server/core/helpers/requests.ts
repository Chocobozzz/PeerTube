import httpSignature from '@peertube/http-signature'
import { CONFIG } from '@server/initializers/config.js'
import { createWriteStream } from 'fs'
import { remove } from 'fs-extra/esm'
import got, { CancelableRequest, OptionsInit, OptionsOfTextResponseBody, OptionsOfUnknownResponseBody, RequestError, Response } from 'got'
import { gotSsrf } from 'got-ssrf'
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
    algorithm: string
    authorizationHeaderName: string
    keyId: string
    key: string
    headers: string[]
  }

  jsonResponse?: boolean

  followRedirect?: boolean
} & Pick<OptionsInit, 'headers' | 'json' | 'method' | 'searchParams'>

export const unsafeSSRFGot = got.extend({
  ...getProxyAgent(),

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
          logger.warn(message, lTags())

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
        headers['host'] = buildUrl(options.url).host
      },

      options => {
        const httpSignatureOptions = options.context?.httpSignature

        if (httpSignatureOptions) {
          const method = options.method ?? 'GET'
          const path = buildUrl(options.url).pathname

          if (!method || !path) {
            throw new Error(`Cannot sign request without method (${method}) or path (${path}) ${options}`)
          }

          httpSignature.signRequest({
            getHeader: function (header: string) {
              const value = options.headers[header.toLowerCase()]

              if (!value) logger.warn('Unknown header requested by http-signature.', { headers: options.headers, header })
              return value
            },

            setHeader: function (header: string, value: string) {
              options.headers[header] = value
            },

            method,
            path
          }, httpSignatureOptions)
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
    .catch(err => { throw buildRequestError(err) })
}

export function doJSONRequest <T> (url: string, options: PeerTubeRequestOptions & { preventSSRF?: false } = {}) {
  const gotOptions = buildGotOptions(options)

  const gotInstance = options.preventSSRF === false
    ? unsafeSSRFGot
    : peertubeGot

  return gotInstance<T>(url, { ...gotOptions, responseType: 'json' })
    .catch(err => { throw buildRequestError(err) })
}

export async function doRequestAndSaveToFile (url: string, destPath: string, options: PeerTubeRequestOptions = {}) {
  const gotOptions = buildGotOptions({ ...options, timeout: options.timeout ?? REQUEST_TIMEOUTS.FILE })

  const outFile = createWriteStream(destPath)

  try {
    await pipelinePromise(
      peertubeGot.stream(url, { ...gotOptions, isStream: true }),
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

  return peertubeGot.stream(url, { ...gotOptions, isStream: true })
}

export function getProxyAgent () {
  if (!isProxyEnabled()) return {}

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

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

function getUserAgent () {
  return `PeerTube/${PEERTUBE_VERSION} (+${WEBSERVER.URL})`
}

function buildGotOptions (options: PeerTubeRequestOptions): OptionsOfUnknownResponseBody {
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
    timeout: {
      request: options.timeout ?? REQUEST_TIMEOUTS.DEFAULT
    },
    json: options.json,
    searchParams: options.searchParams,
    followRedirect: options.followRedirect,
    retry: {
      limit: 2
    },
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

function buildUrl (url: string | URL) {
  if (typeof url === 'string') {
    return new URL(url)
  }

  return url
}
