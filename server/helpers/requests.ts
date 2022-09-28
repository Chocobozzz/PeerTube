import { createWriteStream, remove } from 'fs-extra'
import got, { CancelableRequest, NormalizedOptions, Options as GotOptions, RequestError, Response } from 'got'
import { HttpProxyAgent, HttpsProxyAgent } from 'hpagent'
import { ACTIVITY_PUB, BINARY_CONTENT_TYPES, PEERTUBE_VERSION, REQUEST_TIMEOUTS, WEBSERVER } from '../initializers/constants'
import { pipelinePromise } from './core-utils'
import { logger, loggerTagsFactory } from './logger'
import { getProxy, isProxyEnabled } from './proxy'

const lTags = loggerTagsFactory('request')

const httpSignature = require('@peertube/http-signature')

export interface PeerTubeRequestError extends Error {
  statusCode?: number
  responseBody?: any
  responseHeaders?: any
}

type PeerTubeRequestOptions = {
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
} & Pick<GotOptions, 'headers' | 'json' | 'method' | 'searchParams'>

const peertubeGot = got.extend({
  ...getAgent(),

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
      (_options: NormalizedOptions, error: RequestError, retryCount: number) => {
        logger.debug('Retrying request to %s.', error.request.requestUrl, { retryCount, error: buildRequestError(error), ...lTags() })
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

function getAgent () {
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

function getUserAgent () {
  return `PeerTube/${PEERTUBE_VERSION} (+${WEBSERVER.URL})`
}

function isBinaryResponse (result: Response<any>) {
  return BINARY_CONTENT_TYPES.has(result.headers['content-type'])
}

async function findLatestRedirection (url: string, options: PeerTubeRequestOptions, iteration = 1) {
  if (iteration > 10) throw new Error('Too much iterations to find final URL ' + url)

  const { headers } = await peertubeGot(url, { followRedirect: false, ...buildGotOptions(options) })

  if (headers.location) return findLatestRedirection(headers.location, options, iteration + 1)

  return url
}

// ---------------------------------------------------------------------------

export {
  PeerTubeRequestOptions,

  doRequest,
  doJSONRequest,
  doRequestAndSaveToFile,
  isBinaryResponse,
  getAgent,
  findLatestRedirection,
  peertubeGot
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
    timeout: options.timeout ?? REQUEST_TIMEOUTS.DEFAULT,
    json: options.json,
    searchParams: options.searchParams,
    retry: 2,
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

  return newError
}
