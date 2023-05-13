/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { buildDigest } from '@server/helpers/peertube-crypto'
import { ACTIVITY_PUB, HTTP_SIGNATURE } from '@server/initializers/constants'
import { activityPubContextify } from '@server/lib/activitypub/context'
import { buildGlobalHeaders, signAndContextify } from '@server/lib/activitypub/send'
import { makePOSTAPRequest, SQLCommand } from '@server/tests/shared'
import { buildAbsoluteFixturePath, wait } from '@shared/core-utils'
import { HttpStatusCode } from '@shared/models'
import { cleanupTests, createMultipleServers, killallServers, PeerTubeServer } from '@shared/server-commands'

function setKeysOfServer (onServer: SQLCommand, ofServerUrl: string, publicKey: string, privateKey: string) {
  const url = ofServerUrl + '/accounts/peertube'

  return Promise.all([
    onServer.setActorField(url, 'publicKey', publicKey),
    onServer.setActorField(url, 'privateKey', privateKey)
  ])
}

function setUpdatedAtOfServer (onServer: SQLCommand, ofServerUrl: string, updatedAt: string) {
  const url = ofServerUrl + '/accounts/peertube'

  return Promise.all([
    onServer.setActorField(url, 'createdAt', updatedAt),
    onServer.setActorField(url, 'updatedAt', updatedAt)
  ])
}

function getAnnounceWithoutContext (server: PeerTubeServer) {
  const json = require(buildAbsoluteFixturePath('./ap-json/peertube/announce-without-context.json'))
  const result: typeof json = {}

  for (const key of Object.keys(json)) {
    if (Array.isArray(json[key])) {
      result[key] = json[key].map(v => v.replace(':9002', `:${server.port}`))
    } else {
      result[key] = json[key].replace(':9002', `:${server.port}`)
    }
  }

  return result
}

async function makeFollowRequest (to: { url: string }, by: { url: string, privateKey }) {
  const follow = {
    type: 'Follow',
    id: by.url + '/' + new Date().getTime(),
    actor: by.url,
    object: to.url
  }

  const body = await activityPubContextify(follow, 'Follow')

  const httpSignature = {
    algorithm: HTTP_SIGNATURE.ALGORITHM,
    authorizationHeaderName: HTTP_SIGNATURE.HEADER_NAME,
    keyId: by.url,
    key: by.privateKey,
    headers: HTTP_SIGNATURE.HEADERS_TO_SIGN
  }
  const headers = {
    'digest': buildDigest(body),
    'content-type': 'application/activity+json',
    'accept': ACTIVITY_PUB.ACCEPT_HEADER
  }

  return makePOSTAPRequest(to.url + '/inbox', body, httpSignature, headers)
}

describe('Test ActivityPub security', function () {
  let servers: PeerTubeServer[]
  let sqlCommands: SQLCommand[] = []

  let url: string

  const keys = require(buildAbsoluteFixturePath('./ap-json/peertube/keys.json'))
  const invalidKeys = require(buildAbsoluteFixturePath('./ap-json/peertube/invalid-keys.json'))
  const baseHttpSignature = () => ({
    algorithm: HTTP_SIGNATURE.ALGORITHM,
    authorizationHeaderName: HTTP_SIGNATURE.HEADER_NAME,
    keyId: 'acct:peertube@' + servers[1].host,
    key: keys.privateKey,
    headers: HTTP_SIGNATURE.HEADERS_TO_SIGN
  })

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(60000)

    servers = await createMultipleServers(3)

    sqlCommands = servers.map(s => new SQLCommand(s))

    url = servers[0].url + '/inbox'

    await setKeysOfServer(sqlCommands[0], servers[1].url, keys.publicKey, null)
    await setKeysOfServer(sqlCommands[1], servers[1].url, keys.publicKey, keys.privateKey)

    const to = { url: servers[0].url + '/accounts/peertube' }
    const by = { url: servers[1].url + '/accounts/peertube', privateKey: keys.privateKey }
    await makeFollowRequest(to, by)
  })

  describe('When checking HTTP signature', function () {

    it('Should fail with an invalid digest', async function () {
      const body = await activityPubContextify(getAnnounceWithoutContext(servers[1]), 'Announce')
      const headers = {
        Digest: buildDigest({ hello: 'coucou' })
      }

      try {
        await makePOSTAPRequest(url, body, baseHttpSignature(), headers)
        expect(true, 'Did not throw').to.be.false
      } catch (err) {
        expect(err.statusCode).to.equal(HttpStatusCode.FORBIDDEN_403)
      }
    })

    it('Should fail with an invalid date', async function () {
      const body = await activityPubContextify(getAnnounceWithoutContext(servers[1]), 'Announce')
      const headers = buildGlobalHeaders(body)
      headers['date'] = 'Wed, 21 Oct 2015 07:28:00 GMT'

      try {
        await makePOSTAPRequest(url, body, baseHttpSignature(), headers)
        expect(true, 'Did not throw').to.be.false
      } catch (err) {
        expect(err.statusCode).to.equal(HttpStatusCode.FORBIDDEN_403)
      }
    })

    it('Should fail with bad keys', async function () {
      await setKeysOfServer(sqlCommands[0], servers[1].url, invalidKeys.publicKey, invalidKeys.privateKey)
      await setKeysOfServer(sqlCommands[1], servers[1].url, invalidKeys.publicKey, invalidKeys.privateKey)

      const body = await activityPubContextify(getAnnounceWithoutContext(servers[1]), 'Announce')
      const headers = buildGlobalHeaders(body)

      try {
        await makePOSTAPRequest(url, body, baseHttpSignature(), headers)
        expect(true, 'Did not throw').to.be.false
      } catch (err) {
        expect(err.statusCode).to.equal(HttpStatusCode.FORBIDDEN_403)
      }
    })

    it('Should reject requests without appropriate signed headers', async function () {
      await setKeysOfServer(sqlCommands[0], servers[1].url, keys.publicKey, keys.privateKey)
      await setKeysOfServer(sqlCommands[1], servers[1].url, keys.publicKey, keys.privateKey)

      const body = await activityPubContextify(getAnnounceWithoutContext(servers[1]), 'Announce')
      const headers = buildGlobalHeaders(body)

      const signatureOptions = baseHttpSignature()
      const badHeadersMatrix = [
        [ '(request-target)', 'date', 'digest' ],
        [ 'host', 'date', 'digest' ],
        [ '(request-target)', 'host', 'digest' ]
      ]

      for (const badHeaders of badHeadersMatrix) {
        signatureOptions.headers = badHeaders

        try {
          await makePOSTAPRequest(url, body, signatureOptions, headers)
          expect(true, 'Did not throw').to.be.false
        } catch (err) {
          expect(err.statusCode).to.equal(HttpStatusCode.FORBIDDEN_403)
        }
      }
    })

    it('Should succeed with a valid HTTP signature draft 11 (without date but with (created))', async function () {
      const body = await activityPubContextify(getAnnounceWithoutContext(servers[1]), 'Announce')
      const headers = buildGlobalHeaders(body)

      const signatureOptions = baseHttpSignature()
      signatureOptions.headers = [ '(request-target)', '(created)', 'host', 'digest' ]

      const { statusCode } = await makePOSTAPRequest(url, body, signatureOptions, headers)
      expect(statusCode).to.equal(HttpStatusCode.NO_CONTENT_204)
    })

    it('Should succeed with a valid HTTP signature', async function () {
      const body = await activityPubContextify(getAnnounceWithoutContext(servers[1]), 'Announce')
      const headers = buildGlobalHeaders(body)

      const { statusCode } = await makePOSTAPRequest(url, body, baseHttpSignature(), headers)
      expect(statusCode).to.equal(HttpStatusCode.NO_CONTENT_204)
    })

    it('Should refresh the actor keys', async function () {
      this.timeout(20000)

      // Update keys of server 2 to invalid keys
      // Server 1 should refresh the actor and fail
      await setKeysOfServer(sqlCommands[1], servers[1].url, invalidKeys.publicKey, invalidKeys.privateKey)
      await setUpdatedAtOfServer(sqlCommands[0], servers[1].url, '2015-07-17 22:00:00+00')

      // Invalid peertube actor cache
      await killallServers([ servers[1] ])
      await servers[1].run()

      const body = await activityPubContextify(getAnnounceWithoutContext(servers[1]), 'Announce')
      const headers = buildGlobalHeaders(body)

      try {
        await makePOSTAPRequest(url, body, baseHttpSignature(), headers)
        expect(true, 'Did not throw').to.be.false
      } catch (err) {
        console.error(err)
        expect(err.statusCode).to.equal(HttpStatusCode.FORBIDDEN_403)
      }
    })
  })

  describe('When checking Linked Data Signature', function () {
    before(async function () {
      this.timeout(10000)

      await setKeysOfServer(sqlCommands[0], servers[1].url, keys.publicKey, keys.privateKey)
      await setKeysOfServer(sqlCommands[1], servers[1].url, keys.publicKey, keys.privateKey)
      await setKeysOfServer(sqlCommands[2], servers[2].url, keys.publicKey, keys.privateKey)

      const to = { url: servers[0].url + '/accounts/peertube' }
      const by = { url: servers[2].url + '/accounts/peertube', privateKey: keys.privateKey }
      await makeFollowRequest(to, by)
    })

    it('Should fail with bad keys', async function () {
      this.timeout(10000)

      await setKeysOfServer(sqlCommands[0], servers[2].url, invalidKeys.publicKey, invalidKeys.privateKey)
      await setKeysOfServer(sqlCommands[2], servers[2].url, invalidKeys.publicKey, invalidKeys.privateKey)

      const body = getAnnounceWithoutContext(servers[1])
      body.actor = servers[2].url + '/accounts/peertube'

      const signer: any = { privateKey: invalidKeys.privateKey, url: servers[2].url + '/accounts/peertube' }
      const signedBody = await signAndContextify(signer, body, 'Announce')

      const headers = buildGlobalHeaders(signedBody)

      try {
        await makePOSTAPRequest(url, signedBody, baseHttpSignature(), headers)
        expect(true, 'Did not throw').to.be.false
      } catch (err) {
        expect(err.statusCode).to.equal(HttpStatusCode.FORBIDDEN_403)
      }
    })

    it('Should fail with an altered body', async function () {
      this.timeout(10000)

      await setKeysOfServer(sqlCommands[0], servers[2].url, keys.publicKey, keys.privateKey)
      await setKeysOfServer(sqlCommands[0], servers[2].url, keys.publicKey, keys.privateKey)

      const body = getAnnounceWithoutContext(servers[1])
      body.actor = servers[2].url + '/accounts/peertube'

      const signer: any = { privateKey: keys.privateKey, url: servers[2].url + '/accounts/peertube' }
      const signedBody = await signAndContextify(signer, body, 'Announce')

      signedBody.actor = servers[2].url + '/account/peertube'

      const headers = buildGlobalHeaders(signedBody)

      try {
        await makePOSTAPRequest(url, signedBody, baseHttpSignature(), headers)
        expect(true, 'Did not throw').to.be.false
      } catch (err) {
        expect(err.statusCode).to.equal(HttpStatusCode.FORBIDDEN_403)
      }
    })

    it('Should succeed with a valid signature', async function () {
      this.timeout(10000)

      const body = getAnnounceWithoutContext(servers[1])
      body.actor = servers[2].url + '/accounts/peertube'

      const signer: any = { privateKey: keys.privateKey, url: servers[2].url + '/accounts/peertube' }
      const signedBody = await signAndContextify(signer, body, 'Announce')

      const headers = buildGlobalHeaders(signedBody)

      const { statusCode } = await makePOSTAPRequest(url, signedBody, baseHttpSignature(), headers)
      expect(statusCode).to.equal(HttpStatusCode.NO_CONTENT_204)
    })

    it('Should refresh the actor keys', async function () {
      this.timeout(20000)

      // Wait refresh invalidation
      await wait(10000)

      // Update keys of server 3 to invalid keys
      // Server 1 should refresh the actor and fail
      await setKeysOfServer(sqlCommands[2], servers[2].url, invalidKeys.publicKey, invalidKeys.privateKey)

      const body = getAnnounceWithoutContext(servers[1])
      body.actor = servers[2].url + '/accounts/peertube'

      const signer: any = { privateKey: keys.privateKey, url: servers[2].url + '/accounts/peertube' }
      const signedBody = await signAndContextify(signer, body, 'Announce')

      const headers = buildGlobalHeaders(signedBody)

      try {
        await makePOSTAPRequest(url, signedBody, baseHttpSignature(), headers)
        expect(true, 'Did not throw').to.be.false
      } catch (err) {
        expect(err.statusCode).to.equal(HttpStatusCode.FORBIDDEN_403)
      }
    })
  })

  after(async function () {
    for (const sql of sqlCommands) {
      await sql.cleanup()
    }

    await cleanupTests(servers)
  })
})
