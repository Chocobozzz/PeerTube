'use strict'

const request = require('supertest')

const requestsUtils = {
  makePostUploadRequest,
  makePostBodyRequest,
  makePutBodyRequest
}

// ---------------------- Export functions --------------------

function makePostUploadRequest (url, path, token, fields, attaches, done, statusCodeExpected) {
  if (!statusCodeExpected) statusCodeExpected = 400

  const req = request(url)
    .post(path)
    .set('Accept', 'application/json')

  if (token) req.set('Authorization', 'Bearer ' + token)

  Object.keys(fields).forEach(function (field) {
    const value = fields[field]

    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        req.field(field + '[' + i + ']', value[i])
      }
    } else {
      req.field(field, value)
    }
  })

  Object.keys(attaches).forEach(function (attach) {
    const value = attaches[attach]
    req.attach(attach, value)
  })

  req.expect(statusCodeExpected, done)
}

function makePostBodyRequest (url, path, token, fields, done, statusCodeExpected) {
  if (!statusCodeExpected) statusCodeExpected = 400

  const req = request(url)
    .post(path)
    .set('Accept', 'application/json')

  if (token) req.set('Authorization', 'Bearer ' + token)

  req.send(fields).expect(statusCodeExpected, done)
}

function makePutBodyRequest (url, path, token, fields, done, statusCodeExpected) {
  if (!statusCodeExpected) statusCodeExpected = 400

  const req = request(url)
    .put(path)
    .set('Accept', 'application/json')

  if (token) req.set('Authorization', 'Bearer ' + token)

  req.send(fields).expect(statusCodeExpected, done)
}

// ---------------------------------------------------------------------------

module.exports = requestsUtils
