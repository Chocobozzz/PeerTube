/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/no-floating-promises */

import * as request from 'supertest'
import { buildAbsoluteFixturePath, root } from '../miscs/miscs'
import { isAbsolute, join } from 'path'
import { URL } from 'url'
import { decode } from 'querystring'

function get4KFileUrl () {
  return 'https://download.cpy.re/peertube/4k_file.txt'
}

function makeRawRequest (url: string, statusCodeExpected?: number, range?: string) {
  const { host, protocol, pathname } = new URL(url)

  return makeGetRequest({ url: `${protocol}//${host}`, path: pathname, statusCodeExpected, range })
}

function makeGetRequest (options: {
  url: string
  path?: string
  query?: any
  token?: string
  statusCodeExpected?: number
  contentType?: string
  range?: string
  redirects?: number
}) {
  if (!options.statusCodeExpected) options.statusCodeExpected = 400
  if (options.contentType === undefined) options.contentType = 'application/json'

  const req = request(options.url).get(options.path)

  if (options.contentType) req.set('Accept', options.contentType)
  if (options.token) req.set('Authorization', 'Bearer ' + options.token)
  if (options.query) req.query(options.query)
  if (options.range) req.set('Range', options.range)
  if (options.redirects) req.redirects(options.redirects)

  return req.expect(options.statusCodeExpected)
}

function makeDeleteRequest (options: {
  url: string
  path: string
  token?: string
  statusCodeExpected?: number
}) {
  if (!options.statusCodeExpected) options.statusCodeExpected = 400

  const req = request(options.url)
    .delete(options.path)
    .set('Accept', 'application/json')

  if (options.token) req.set('Authorization', 'Bearer ' + options.token)

  return req.expect(options.statusCodeExpected)
}

function makeUploadRequest (options: {
  url: string
  method?: 'POST' | 'PUT'
  path: string
  token?: string
  fields: { [ fieldName: string ]: any }
  attaches: { [ attachName: string ]: any | any[] }
  statusCodeExpected?: number
}) {
  if (!options.statusCodeExpected) options.statusCodeExpected = 400

  let req: request.Test
  if (options.method === 'PUT') {
    req = request(options.url).put(options.path)
  } else {
    req = request(options.url).post(options.path)
  }

  req.set('Accept', 'application/json')

  if (options.token) req.set('Authorization', 'Bearer ' + options.token)

  Object.keys(options.fields).forEach(field => {
    const value = options.fields[field]

    if (value === undefined) return

    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        req.field(field + '[' + i + ']', value[i])
      }
    } else {
      req.field(field, value)
    }
  })

  Object.keys(options.attaches).forEach(attach => {
    const value = options.attaches[attach]
    if (Array.isArray(value)) {
      req.attach(attach, buildAbsoluteFixturePath(value[0]), value[1])
    } else {
      req.attach(attach, buildAbsoluteFixturePath(value))
    }
  })

  return req.expect(options.statusCodeExpected)
}

function makePostBodyRequest (options: {
  url: string
  path: string
  token?: string
  fields?: { [ fieldName: string ]: any }
  statusCodeExpected?: number
}) {
  if (!options.fields) options.fields = {}
  if (!options.statusCodeExpected) options.statusCodeExpected = 400

  const req = request(options.url)
                .post(options.path)
                .set('Accept', 'application/json')

  if (options.token) req.set('Authorization', 'Bearer ' + options.token)

  return req.send(options.fields)
            .expect(options.statusCodeExpected)
}

function makePutBodyRequest (options: {
  url: string
  path: string
  token?: string
  fields: { [ fieldName: string ]: any }
  statusCodeExpected?: number
}) {
  if (!options.statusCodeExpected) options.statusCodeExpected = 400

  const req = request(options.url)
                .put(options.path)
                .set('Accept', 'application/json')

  if (options.token) req.set('Authorization', 'Bearer ' + options.token)

  return req.send(options.fields)
            .expect(options.statusCodeExpected)
}

function makeHTMLRequest (url: string, path: string) {
  return request(url)
    .get(path)
    .set('Accept', 'text/html')
    .expect(200)
}

function updateAvatarRequest (options: {
  url: string
  path: string
  accessToken: string
  fixture: string
}) {
  let filePath = ''
  if (isAbsolute(options.fixture)) {
    filePath = options.fixture
  } else {
    filePath = join(root(), 'server', 'tests', 'fixtures', options.fixture)
  }

  return makeUploadRequest({
    url: options.url,
    path: options.path,
    token: options.accessToken,
    fields: {},
    attaches: { avatarfile: filePath },
    statusCodeExpected: 200
  })
}

function decodeQueryString (path: string) {
  return decode(path.split('?')[1])
}

// ---------------------------------------------------------------------------

export {
  get4KFileUrl,
  makeHTMLRequest,
  makeGetRequest,
  decodeQueryString,
  makeUploadRequest,
  makePostBodyRequest,
  makePutBodyRequest,
  makeDeleteRequest,
  makeRawRequest,
  updateAvatarRequest
}
