import * as request from 'supertest'
import { buildAbsoluteFixturePath } from '../miscs/miscs'

function makeGetRequest (options: {
  url: string,
  path: string,
  query?: any,
  token?: string,
  statusCodeExpected?: number
}) {
  if (!options.statusCodeExpected) options.statusCodeExpected = 400

  const req = request(options.url)
    .get(options.path)
    .set('Accept', 'application/json')

  if (options.token) req.set('Authorization', 'Bearer ' + options.token)
  if (options.query) req.query(options.query)

  return req
    .expect('Content-Type', /json/)
    .expect(options.statusCodeExpected)
}

function makeDeleteRequest (options: {
  url: string,
  path: string,
  token?: string,
  statusCodeExpected?: number
}) {
  if (!options.statusCodeExpected) options.statusCodeExpected = 400

  const req = request(options.url)
    .delete(options.path)
    .set('Accept', 'application/json')

  if (options.token) req.set('Authorization', 'Bearer ' + options.token)

  return req
    .expect('Content-Type', /json/)
    .expect(options.statusCodeExpected)
}

function makeUploadRequest (options: {
  url: string,
  method?: 'POST' | 'PUT',
  path: string,
  token: string,
  fields: { [ fieldName: string ]: any },
  attaches: { [ attachName: string ]: any },
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
    req.attach(attach, buildAbsoluteFixturePath(value))
  })

  return req.expect(options.statusCodeExpected)
}

function makePostBodyRequest (options: {
  url: string,
  path: string,
  token?: string,
  fields?: { [ fieldName: string ]: any },
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
  url: string,
  path: string,
  token?: string,
  fields: { [ fieldName: string ]: any },
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

// ---------------------------------------------------------------------------

export {
  makeGetRequest,
  makeUploadRequest,
  makePostBodyRequest,
  makePutBodyRequest,
  makeDeleteRequest
}
