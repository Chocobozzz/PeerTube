/* eslint-disable @typescript-eslint/no-floating-promises */

import { decode } from 'querystring'
import request from 'supertest'
import { URL } from 'url'
import { pick, queryParamsToObject } from '@peertube/peertube-core-utils'
import { HttpStatusCode, HttpStatusCodeType } from '@peertube/peertube-models'
import { buildAbsoluteFixturePath } from '@peertube/peertube-node-utils'

export type CommonRequestParams = {
  url: string
  path?: string
  contentType?: string
  responseType?: string
  range?: string
  redirects?: number
  accept?: string
  host?: string
  token?: string
  headers?: { [ name: string ]: string }
  type?: string
  xForwardedFor?: string
  expectedStatus?: HttpStatusCodeType
}

export function makeRawRequest (options: {
  url: string
  token?: string
  expectedStatus?: HttpStatusCodeType
  responseType?: string
  range?: string
  query?: { [ id: string ]: string }
  method?: 'GET' | 'POST'
  accept?: string
  headers?: { [ name: string ]: string }
  redirects?: number
}) {
  const { host, protocol, pathname, searchParams } = new URL(options.url)

  const reqOptions = {
    url: `${protocol}//${host}`,
    path: pathname,

    contentType: undefined,

    query: {
      ...(options.query || {}),

      ...queryParamsToObject(searchParams)
    },

    ...pick(options, [ 'expectedStatus', 'range', 'token', 'headers', 'responseType', 'accept', 'redirects' ])
  }

  if (options.method === 'POST') {
    return makePostBodyRequest(reqOptions)
  }

  return makeGetRequest(reqOptions)
}

export const makeFileRequest = (url: string) => {
  return makeRawRequest({
    url,
    responseType: 'arraybuffer',
    redirects: 1,
    expectedStatus: HttpStatusCode.OK_200
  })
}

export function makeGetRequest (options: CommonRequestParams & {
  query?: any
  rawQuery?: string
}) {
  const req = request(options.url).get(options.path)

  if (options.query) req.query(options.query)
  if (options.rawQuery) req.query(options.rawQuery)

  return buildRequest(req, { contentType: 'application/json', expectedStatus: HttpStatusCode.BAD_REQUEST_400, ...options })
}

export function makeHTMLRequest (url: string, path: string) {
  return makeGetRequest({
    url,
    path,
    accept: 'text/html',
    expectedStatus: HttpStatusCode.OK_200
  })
}

// ---------------------------------------------------------------------------

export function makeActivityPubGetRequest (url: string, path: string, expectedStatus: HttpStatusCodeType = HttpStatusCode.OK_200) {
  return makeGetRequest({
    url,
    path,
    expectedStatus,
    accept: 'application/activity+json,text/html;q=0.9,\\*/\\*;q=0.8'
  })
}

export function makeActivityPubRawRequest (url: string, expectedStatus: HttpStatusCodeType = HttpStatusCode.OK_200) {
  return makeRawRequest({
    url,
    expectedStatus,
    accept: 'application/activity+json,text/html;q=0.9,\\*/\\*;q=0.8'
  })
}

// ---------------------------------------------------------------------------

export function makeDeleteRequest (options: CommonRequestParams & {
  query?: any
  rawQuery?: string
}) {
  const req = request(options.url).delete(options.path)

  if (options.query) req.query(options.query)
  if (options.rawQuery) req.query(options.rawQuery)

  return buildRequest(req, { accept: 'application/json', expectedStatus: HttpStatusCode.BAD_REQUEST_400, ...options })
}

export function makeUploadRequest (options: CommonRequestParams & {
  method?: 'POST' | 'PUT'

  fields: { [ fieldName: string ]: any }
  attaches?: { [ attachName: string ]: any | any[] }
}) {
  let req = options.method === 'PUT'
    ? request(options.url).put(options.path)
    : request(options.url).post(options.path)

  req = buildRequest(req, { accept: 'application/json', expectedStatus: HttpStatusCode.BAD_REQUEST_400, ...options })

  buildFields(req, options.fields)

  Object.keys(options.attaches || {}).forEach(attach => {
    const value = options.attaches[attach]
    if (!value) return

    if (Array.isArray(value)) {
      req.attach(
        attach,
        value[0] instanceof Buffer
          ? value[0]
          : buildAbsoluteFixturePath(value[0]),
        value[1]
      )
    } else {
      req.attach(
        attach,
        value instanceof Buffer
          ? value
          : buildAbsoluteFixturePath(value)
      )
    }
  })

  return req
}

export function makePostBodyRequest (options: CommonRequestParams & {
  fields?: { [ fieldName: string ]: any }
}) {
  const req = request(options.url).post(options.path)
                                  .send(options.fields)

  return buildRequest(req, { accept: 'application/json', expectedStatus: HttpStatusCode.BAD_REQUEST_400, ...options })
}

export function makePutBodyRequest (options: {
  url: string
  path: string
  token?: string
  fields: { [ fieldName: string ]: any }
  expectedStatus?: HttpStatusCodeType
  headers?: { [name: string]: string }
}) {
  const req = request(options.url).put(options.path)
                                  .send(options.fields)

  return buildRequest(req, { accept: 'application/json', expectedStatus: HttpStatusCode.BAD_REQUEST_400, ...options })
}

// ---------------------------------------------------------------------------

export async function getRedirectionUrl (url: string, token?: string) {
  const res = await makeRawRequest({
    url,
    token,
    redirects: 0,
    expectedStatus: HttpStatusCode.FOUND_302
  })

  return res.headers['location']
}

// ---------------------------------------------------------------------------

export function decodeQueryString (path: string) {
  return decode(path.split('?')[1])
}

// ---------------------------------------------------------------------------

export function unwrapBody <T> (test: request.Test): Promise<T> {
  return test.then(res => res.body)
}

export function unwrapText (test: request.Test): Promise<string> {
  return test.then(res => res.text)
}

export function unwrapBodyOrDecodeToJSON <T> (test: request.Test): Promise<T> {
  return test.then(res => {
    if (res.body instanceof Buffer) {
      try {
        return JSON.parse(new TextDecoder().decode(res.body))
      } catch (err) {
        console.error('Cannot decode JSON.', { res, body: res.body instanceof Buffer ? res.body.toString() : res.body })
        throw err
      }
    }

    if (res.text) {
      try {
        return JSON.parse(res.text)
      } catch (err) {
        console.error('Cannot decode json', { res, text: res.text })
        throw err
      }
    }

    return res.body
  })
}

export function unwrapTextOrDecode (test: request.Test): Promise<string> {
  return test.then(res => res.text || new TextDecoder().decode(res.body))
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

function buildRequest (req: request.Test, options: CommonRequestParams) {
  if (options.contentType) req.set('Accept', options.contentType)
  if (options.responseType) req.responseType(options.responseType)
  if (options.token) req.set('Authorization', 'Bearer ' + options.token)
  if (options.range) req.set('Range', options.range)
  if (options.accept) req.set('Accept', options.accept)
  if (options.host) req.set('Host', options.host)
  if (options.redirects) req.redirects(options.redirects)
  if (options.xForwardedFor) req.set('X-Forwarded-For', options.xForwardedFor)
  if (options.type) req.type(options.type)

  Object.keys(options.headers || {}).forEach(name => {
    req.set(name, options.headers[name])
  })

  return req.expect(res => {
    if (options.expectedStatus && res.status !== options.expectedStatus) {
      const err = new Error(`Expected status ${options.expectedStatus}, got ${res.status}. ` +
        `\nThe server responded: "${res.body?.error ?? res.text}".\n` +
        'You may take a closer look at the logs. To see how to do so, check out this page: ' +
        'https://github.com/Chocobozzz/PeerTube/blob/develop/support/doc/development/tests.md#debug-server-logs');

      (err as any).res = res

      throw err
    }

    return res
  })
}

function buildFields (req: request.Test, fields: { [ fieldName: string ]: any }, namespace?: string) {
  if (!fields) return

  let formKey: string

  for (const key of Object.keys(fields)) {
    if (namespace) formKey = `${namespace}[${key}]`
    else formKey = key

    if (fields[key] === undefined) continue

    if (Array.isArray(fields[key]) && fields[key].length === 0) {
      req.field(key, [])
      continue
    }

    if (fields[key] !== null && typeof fields[key] === 'object') {
      buildFields(req, fields[key], formKey)
    } else {
      req.field(formKey, fields[key])
    }
  }
}
