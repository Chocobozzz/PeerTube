/* tslint:disable:no-unused-expression */

import 'mocha'

import {
  closeAllSequelize,
  flushAndRunMultipleServers,
  flushTests,
  killallServers,
  ServerInfo,
  setActorField
} from '../../../../shared/extra-utils'
import { HTTP_SIGNATURE } from '../../../initializers/constants'
import { buildDigest, buildGlobalHeaders } from '../../../lib/job-queue/handlers/utils/activitypub-http-utils'
import * as chai from 'chai'
import { activityPubContextify, buildSignedActivity } from '../../../helpers/activitypub'
import { makeFollowRequest, makePOSTAPRequest } from '../../../../shared/extra-utils/requests/activitypub'

const expect = chai.expect

function setKeysOfServer2 (serverNumber: number, publicKey: string, privateKey: string) {
  return Promise.all([
    setActorField(serverNumber, 'http://localhost:9002/accounts/peertube', 'publicKey', publicKey),
    setActorField(serverNumber, 'http://localhost:9002/accounts/peertube', 'privateKey', privateKey)
  ])
}

function setKeysOfServer3 (serverNumber: number, publicKey: string, privateKey: string) {
  return Promise.all([
    setActorField(serverNumber, 'http://localhost:9003/accounts/peertube', 'publicKey', publicKey),
    setActorField(serverNumber, 'http://localhost:9003/accounts/peertube', 'privateKey', privateKey)
  ])
}

describe('Test ActivityPub security', function () {
  let servers: ServerInfo[]
  let url: string

  const keys = require('./json/peertube/keys.json')
  const invalidKeys = require('./json/peertube/invalid-keys.json')
  const baseHttpSignature = {
    algorithm: HTTP_SIGNATURE.ALGORITHM,
    authorizationHeaderName: HTTP_SIGNATURE.HEADER_NAME,
    keyId: 'acct:peertube@localhost:9002',
    key: keys.privateKey,
    headers: HTTP_SIGNATURE.HEADERS_TO_SIGN
  }

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(60000)

    servers = await flushAndRunMultipleServers(3)

    url = servers[0].url + '/inbox'

    await setKeysOfServer2(1, keys.publicKey, keys.privateKey)

    const to = { url: 'http://localhost:9001/accounts/peertube' }
    const by = { url: 'http://localhost:9002/accounts/peertube', privateKey: keys.privateKey }
    await makeFollowRequest(to, by)
  })

  describe('When checking HTTP signature', function () {

    it('Should fail with an invalid digest', async function () {
      const body = activityPubContextify(require('./json/peertube/announce-without-context.json'))
      const headers = {
        Digest: buildDigest({ hello: 'coucou' })
      }

      const { response } = await makePOSTAPRequest(url, body, baseHttpSignature, headers)

      expect(response.statusCode).to.equal(403)
    })

    it('Should fail with an invalid date', async function () {
      const body = activityPubContextify(require('./json/peertube/announce-without-context.json'))
      const headers = buildGlobalHeaders(body)
      headers['date'] = 'Wed, 21 Oct 2015 07:28:00 GMT'

      const { response } = await makePOSTAPRequest(url, body, baseHttpSignature, headers)

      expect(response.statusCode).to.equal(403)
    })

    it('Should fail with bad keys', async function () {
      await setKeysOfServer2(1, invalidKeys.publicKey, invalidKeys.privateKey)
      await setKeysOfServer2(2, invalidKeys.publicKey, invalidKeys.privateKey)

      const body = activityPubContextify(require('./json/peertube/announce-without-context.json'))
      const headers = buildGlobalHeaders(body)

      const { response } = await makePOSTAPRequest(url, body, baseHttpSignature, headers)

      expect(response.statusCode).to.equal(403)
    })

    it('Should succeed with a valid HTTP signature', async function () {
      await setKeysOfServer2(1, keys.publicKey, keys.privateKey)
      await setKeysOfServer2(2, keys.publicKey, keys.privateKey)

      const body = activityPubContextify(require('./json/peertube/announce-without-context.json'))
      const headers = buildGlobalHeaders(body)

      const { response } = await makePOSTAPRequest(url, body, baseHttpSignature, headers)

      expect(response.statusCode).to.equal(204)
    })
  })

  describe('When checking Linked Data Signature', function () {
    before(async () => {
      await setKeysOfServer3(3, keys.publicKey, keys.privateKey)

      const to = { url: 'http://localhost:9001/accounts/peertube' }
      const by = { url: 'http://localhost:9003/accounts/peertube', privateKey: keys.privateKey }
      await makeFollowRequest(to, by)
    })

    it('Should fail with bad keys', async function () {
      this.timeout(10000)

      await setKeysOfServer3(1, invalidKeys.publicKey, invalidKeys.privateKey)
      await setKeysOfServer3(3, invalidKeys.publicKey, invalidKeys.privateKey)

      const body = require('./json/peertube/announce-without-context.json')
      body.actor = 'http://localhost:9003/accounts/peertube'

      const signer: any = { privateKey: invalidKeys.privateKey, url: 'http://localhost:9003/accounts/peertube' }
      const signedBody = await buildSignedActivity(signer, body)

      const headers = buildGlobalHeaders(signedBody)

      const { response } = await makePOSTAPRequest(url, signedBody, baseHttpSignature, headers)

      expect(response.statusCode).to.equal(403)
    })

    it('Should fail with an altered body', async function () {
      this.timeout(10000)

      await setKeysOfServer3(1, keys.publicKey, keys.privateKey)
      await setKeysOfServer3(3, keys.publicKey, keys.privateKey)

      const body = require('./json/peertube/announce-without-context.json')
      body.actor = 'http://localhost:9003/accounts/peertube'

      const signer: any = { privateKey: keys.privateKey, url: 'http://localhost:9003/accounts/peertube' }
      const signedBody = await buildSignedActivity(signer, body)

      signedBody.actor = 'http://localhost:9003/account/peertube'

      const headers = buildGlobalHeaders(signedBody)

      const { response } = await makePOSTAPRequest(url, signedBody, baseHttpSignature, headers)

      expect(response.statusCode).to.equal(403)
    })

    it('Should succeed with a valid signature', async function () {
      this.timeout(10000)

      const body = require('./json/peertube/announce-without-context.json')
      body.actor = 'http://localhost:9003/accounts/peertube'

      const signer: any = { privateKey: keys.privateKey, url: 'http://localhost:9003/accounts/peertube' }
      const signedBody = await buildSignedActivity(signer, body)

      const headers = buildGlobalHeaders(signedBody)

      const { response } = await makePOSTAPRequest(url, signedBody, baseHttpSignature, headers)

      expect(response.statusCode).to.equal(204)
    })
  })

  after(async function () {
    killallServers(servers)

    await closeAllSequelize(servers)
  })
})
