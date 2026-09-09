/* oxlint-disable @typescript-eslint/no-unused-expressions */

import { HttpStatusCode } from '@peertube/peertube-models'
import { getRemoteErrorLogLevel, isExpectedRemoteError } from '@peertube/peertube-server/core/helpers/remote-errors.js'
import { PeerTubeRequestError } from '@peertube/peertube-server/core/helpers/requests.js'
import { expect } from 'chai'

function buildRequestError (options: { statusCode?: number, code?: string, name?: string }) {
  const err: PeerTubeRequestError = new Error('fake request error')
  err.name = options.name || 'RequestError'
  err.statusCode = options.statusCode
  err.code = options.code

  return err
}

describe('Remote errors helpers', function () {
  it('Should consider remote HTTP status codes as expected', function () {
    const statusCodes = [
      HttpStatusCode.UNAUTHORIZED_401,
      HttpStatusCode.FORBIDDEN_403,
      HttpStatusCode.NOT_FOUND_404,
      HttpStatusCode.GONE_410
    ]

    for (const statusCode of statusCodes) {
      expect(isExpectedRemoteError(buildRequestError({ statusCode })), 'status code ' + statusCode).to.be.true
    }
  })

  it('Should not consider remote server errors as expected', function () {
    for (const statusCode of [ HttpStatusCode.BAD_REQUEST_400, HttpStatusCode.INTERNAL_SERVER_ERROR_500 ]) {
      expect(isExpectedRemoteError(buildRequestError({ statusCode })), 'status code ' + statusCode).to.be.false
    }
  })

  it('Should consider network and TLS error codes as expected', function () {
    for (const code of [ 'ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT', 'CERT_HAS_EXPIRED', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' ]) {
      expect(isExpectedRemoteError(buildRequestError({ code })), code).to.be.true
    }

    expect(isExpectedRemoteError(buildRequestError({ code: 'EACCES' }))).to.be.false
  })

  it('Should consider timeout and malformed JSON-LD errors as expected', function () {
    expect(isExpectedRemoteError(buildRequestError({ name: 'TimeoutError' }))).to.be.true

    const jsonldError = new Error('Safe mode validation error.')
    jsonldError.name = 'jsonld.ValidationError'
    expect(isExpectedRemoteError(jsonldError)).to.be.true
  })

  it('Should not consider local errors as expected', function () {
    expect(isExpectedRemoteError(new TypeError('cannot read property of undefined'))).to.be.false

    const sequelizeError = new Error('duplicate key value violates unique constraint')
    sequelizeError.name = 'SequelizeUniqueConstraintError'
    expect(isExpectedRemoteError(sequelizeError)).to.be.false

    expect(isExpectedRemoteError(undefined)).to.be.false
  })

  it('Should build the appropriate log level', function () {
    expect(getRemoteErrorLogLevel(buildRequestError({ statusCode: HttpStatusCode.UNAUTHORIZED_401 }))).to.equal('debug')
    expect(getRemoteErrorLogLevel(buildRequestError({ code: 'CERT_HAS_EXPIRED' }))).to.equal('debug')

    expect(getRemoteErrorLogLevel(new TypeError('local bug'))).to.equal('warn')
    expect(getRemoteErrorLogLevel(new TypeError('local bug'), 'error')).to.equal('error')
  })
})
