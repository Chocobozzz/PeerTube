/* eslint-disable @typescript-eslint/no-floating-promises */

import { decode } from 'querystring'
import request from 'supertest'
import { URL } from 'url'
import { buildAbsoluteFixturePath, pick } from '@shared/core-utils'
import { HttpStatusCode } from '@shared/models'

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
  expectedStatus?: HttpStatusCode
}

function makeRawRequest (options: {
  url: string
  token?: string
  expectedStatus?: HttpStatusCode
  range?: string
  query?: { [ id: string ]: string }
  method?: 'GET' | 'POST'
  headers?: { [ name: string ]: string }
}) {
  const { host, protocol, pathname } = new URL(options.url)

  const reqOptions = {
    url: `${protocol}//${host}`,
    path: pathname,
    contentType: undefined,

    ...pick(options, [ 'expectedStatus', 'range', 'token', 'query', 'headers' ])
  }

  if (options.method === 'POST') {
    return makePostBodyRequest(reqOptions)
  }

  return makeGetRequest(reqOptions)
}

function makeGetRequest (options: CommonRequestParams & {
  query?: any
  rawQuery?: string
}) {
  const req = request(options.url).get(options.path)

  if (options.query) req.query(options.query)
  if (options.rawQuery) req.query(options.rawQuery)

  return buildRequest(req, { contentType: 'application/json', expectedStatus: HttpStatusCode.BAD_REQUEST_400, ...options })
}

function makeHTMLRequest (url: string, path: string) {
  return makeGetRequest({
    url,
    path,
    accept: 'text/html',
    expectedStatus: HttpStatusCode.OK_200
  })
}

function makeActivityPubGetRequest (url: string, path: string, expectedStatus = HttpStatusCode.OK_200) {
  return makeGetRequest({
    url,
    path,
    expectedStatus,
    accept: 'application/activity+json,text/html;q=0.9,\\*/\\*;q=0.8'
  })
}

function makeDeleteRequest (options: CommonRequestParams & {
  query?: any
  rawQuery?: string
}) {
  const req = request(options.url).delete(options.path)

  if (options.query) req.query(options.query)
  if (options.rawQuery) req.query(options.rawQuery)

  return buildRequest(req, { accept: 'application/json', expectedStatus: HttpStatusCode.BAD_REQUEST_400, ...options })
}

function makeUploadRequest (options: CommonRequestParams & {
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
      req.attach(attach, buildAbsoluteFixturePath(value[0]), value[1])
    } else {
      req.attach(attach, buildAbsoluteFixturePath(value))
    }
  })

  return req
}

function makePostBodyRequest (options: CommonRequestParams & {
  fields?: { [ fieldName: string ]: any }
}) {
  const req = request(options.url).post(options.path)
                                  .send(options.fields)

  return buildRequest(req, { accept: 'application/json', expectedStatus: HttpStatusCode.BAD_REQUEST_400, ...options })
}

function makePutBodyRequest (options: {
  url: string
  path: string
  token?: string
  fields: { [ fieldName: string ]: any }
  expectedStatus?: HttpStatusCode
  headers?: { [name: string]: string }
}) {
  const req = request(options.url).put(options.path)
                                  .send(options.fields)

  return buildRequest(req, { accept: 'application/json', expectedStatus: HttpStatusCode.BAD_REQUEST_400, ...options })
}

function decodeQueryString (path: string) {
  return decode(path.split('?')[1])
}

// ---------------------------------------------------------------------------

function unwrapBody <T> (test: request.Test): Promise<T> {
  return test.then(res => res.body)
}

function unwrapText (test: request.Test): Promise<string> {
  return test.then(res => res.text)
}

function unwrapBodyOrDecodeToJSON <T> (test: request.Test): Promise<T> {
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

function unwrapTextOrDecode (test: request.Test): Promise<string> {
  return test.then(res => res.text || new TextDecoder().decode(res.body))
}

// ---------------------------------------------------------------------------

export {
  makeHTMLRequest,
  makeGetRequest,
  decodeQueryString,
  makeUploadRequest,
  makePostBodyRequest,
  makePutBodyRequest,
  makeDeleteRequest,
  makeRawRequest,
  makeActivityPubGetRequest,
  unwrapBody,
  unwrapTextOrDecode,
  unwrapBodyOrDecodeToJSON,
  unwrapText
}

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
