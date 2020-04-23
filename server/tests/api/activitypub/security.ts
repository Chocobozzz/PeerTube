/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'

import { cleanupTests, closeAllSequelize, flushAndRunMultipleServers, ServerInfo, setActorField } from '../../../../shared/extra-utils'
import { HTTP_SIGNATURE } from '../../../initializers/constants'
import { buildGlobalHeaders } from '../../../lib/job-queue/handlers/utils/activitypub-http-utils'
import * as chai from 'chai'
import { activityPubContextify, buildSignedActivity } from '../../../helpers/activitypub'
import { makeFollowRequest, makePOSTAPRequest } from '../../../../shared/extra-utils/requests/activitypub'
import { buildDigest } from '@server/helpers/peertube-crypto'

const expect = chai.expect

function setKeysOfServer (onServer: ServerInfo, ofServer: ServerInfo, publicKey: string, privateKey: string) {
  return Promise.all([
    setActorField(onServer.internalServerNumber, 'http://localhost:' + ofServer.port + '/accounts/peertube', 'publicKey', publicKey),
    setActorField(onServer.internalServerNumber, 'http://localhost:' + ofServer.port + '/accounts/peertube', 'privateKey', privateKey)
  ])
}

function getAnnounceWithoutContext (server2: ServerInfo) {
  const json = require('./json/peertube/announce-without-context.json')
  const result: typeof json = {}

  for (const key of Object.keys(json)) {
    if (Array.isArray(json[key])) {
      result[key] = json[key].map(v => v.replace(':9002', `:${server2.port}`))
    } else {
      result[key] = json[key].replace(':9002', `:${server2.port}`)
    }
  }

  return result
}

describe('Test ActivityPub security', function () {
  let servers: ServerInfo[]
  let url: string

  const keys = require('./json/peertube/keys.json')
  const invalidKeys = require('./json/peertube/invalid-keys.json')
  const baseHttpSignature = () => ({
    algorithm: HTTP_SIGNATURE.ALGORITHM,
    authorizationHeaderName: HTTP_SIGNATURE.HEADER_NAME,
    keyId: 'acct:peertube@localhost:' + servers[1].port,
    key: keys.privateKey,
    headers: HTTP_SIGNATURE.HEADERS_TO_SIGN
  })

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(60000)

    servers = await flushAndRunMultipleServers(3)

    url = servers[0].url + '/inbox'

    await setKeysOfServer(servers[0], servers[1], keys.publicKey, keys.privateKey)

    const to = { url: 'http://localhost:' + servers[0].port + '/accounts/peertube' }
    const by = { url: 'http://localhost:' + servers[1].port + '/accounts/peertube', privateKey: keys.privateKey }
    await makeFollowRequest(to, by)
  })

  describe('When checking HTTP signature', function () {

    it('Should fail with an invalid digest', async function () {
      const body = activityPubContextify(getAnnounceWithoutContext(servers[1]))
      const headers = {
        Digest: buildDigest({ hello: 'coucou' })
      }

      const { response } = await makePOSTAPRequest(url, body, baseHttpSignature(), headers)

      expect(response.statusCode).to.equal(403)
    })

    it('Should fail with an invalid date', async function () {
      const body = activityPubContextify(getAnnounceWithoutContext(servers[1]))
      const headers = buildGlobalHeaders(body)
      headers['date'] = 'Wed, 21 Oct 2015 07:28:00 GMT'

      const { response } = await makePOSTAPRequest(url, body, baseHttpSignature(), headers)

      expect(response.statusCode).to.equal(403)
    })

    it('Should fail with bad keys', async function () {
      await setKeysOfServer(servers[0], servers[1], invalidKeys.publicKey, invalidKeys.privateKey)
      await setKeysOfServer(servers[1], servers[1], invalidKeys.publicKey, invalidKeys.privateKey)

      const body = activityPubContextify(getAnnounceWithoutContext(servers[1]))
      const headers = buildGlobalHeaders(body)

      const { response } = await makePOSTAPRequest(url, body, baseHttpSignature(), headers)

      expect(response.statusCode).to.equal(403)
    })

    it('Should succeed with a valid HTTP signature', async function () {
      await setKeysOfServer(servers[0], servers[1], keys.publicKey, keys.privateKey)
      await setKeysOfServer(servers[1], servers[1], keys.publicKey, keys.privateKey)

      const body = activityPubContextify(getAnnounceWithoutContext(servers[1]))
      const headers = buildGlobalHeaders(body)

      const { response } = await makePOSTAPRequest(url, body, baseHttpSignature(), headers)

      expect(response.statusCode).to.equal(204)
    })
  })

  describe('When checking Linked Data Signature', function () {
    before(async () => {
      await setKeysOfServer(servers[2], servers[2], keys.publicKey, keys.privateKey)

      const to = { url: 'http://localhost:' + servers[0].port + '/accounts/peertube' }
      const by = { url: 'http://localhost:' + servers[2].port + '/accounts/peertube', privateKey: keys.privateKey }
      await makeFollowRequest(to, by)
    })

    it('Should fail with bad keys', async function () {
      this.timeout(10000)

      await setKeysOfServer(servers[0], servers[2], invalidKeys.publicKey, invalidKeys.privateKey)
      await setKeysOfServer(servers[2], servers[2], invalidKeys.publicKey, invalidKeys.privateKey)

      const body = getAnnounceWithoutContext(servers[1])
      body.actor = 'http://localhost:' + servers[2].port + '/accounts/peertube'

      const signer: any = { privateKey: invalidKeys.privateKey, url: 'http://localhost:' + servers[2].port + '/accounts/peertube' }
      const signedBody = await buildSignedActivity(signer, body)

      const headers = buildGlobalHeaders(signedBody)

      const { response } = await makePOSTAPRequest(url, signedBody, baseHttpSignature(), headers)

      expect(response.statusCode).to.equal(403)
    })

    it('Should fail with an altered body', async function () {
      this.timeout(10000)

      await setKeysOfServer(servers[0], servers[2], keys.publicKey, keys.privateKey)
      await setKeysOfServer(servers[0], servers[2], keys.publicKey, keys.privateKey)

      const body = getAnnounceWithoutContext(servers[1])
      body.actor = 'http://localhost:' + servers[2].port + '/accounts/peertube'

      const signer: any = { privateKey: keys.privateKey, url: 'http://localhost:' + servers[2].port + '/accounts/peertube' }
      const signedBody = await buildSignedActivity(signer, body)

      signedBody.actor = 'http://localhost:' + servers[2].port + '/account/peertube'

      const headers = buildGlobalHeaders(signedBody)

      const { response } = await makePOSTAPRequest(url, signedBody, baseHttpSignature(), headers)

      expect(response.statusCode).to.equal(403)
    })

    it('Should succeed with a valid signature', async function () {
      this.timeout(10000)

      const body = getAnnounceWithoutContext(servers[1])
      body.actor = 'http://localhost:' + servers[2].port + '/accounts/peertube'

      const signer: any = { privateKey: keys.privateKey, url: 'http://localhost:' + servers[2].port + '/accounts/peertube' }
      const signedBody = await buildSignedActivity(signer, body)

      const headers = buildGlobalHeaders(signedBody)

      const { response } = await makePOSTAPRequest(url, signedBody, baseHttpSignature(), headers)

      expect(response.statusCode).to.equal(204)
    })
  })

  after(async function () {
    this.timeout(10000)

    await cleanupTests(servers)

    await closeAllSequelize(servers)
  })
})
