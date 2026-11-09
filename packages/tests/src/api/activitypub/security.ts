/* oxlint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { signAsDraftToRequest } from '@misskey-dev/node-http-message-signatures'
import { wait } from '@peertube/peertube-core-utils'
import { HttpStatusCode } from '@peertube/peertube-models'
import { buildAbsoluteFixturePath } from '@peertube/peertube-node-utils'
import { PeerTubeServer, cleanupTests, createMultipleServers, killallServers } from '@peertube/peertube-server-commands'
import {
  activityPubContextify,
  buildGlobalHTTPHeaders,
  signAndContextify
} from '@peertube/peertube-server/core/helpers/activity-pub-utils.js'
import { buildDigest } from '@peertube/peertube-server/core/helpers/peertube-crypto.js'
import { signJsonLDObject } from '@peertube/peertube-server/core/helpers/peertube-jsonld.js'
import { ACTIVITY_PUB, HTTP_SIGNATURE } from '@peertube/peertube-server/core/initializers/constants.js'
import { fakeContextFilter, makePOSTAPRequest, makeSignedPOSTAPRequest } from '@tests/shared/requests.js'
import { SQLCommand } from '@tests/shared/sql-command.js'
import { expect } from 'chai'
import { createSign } from 'crypto'
import { readJsonSync } from 'fs-extra/esm'
import { request } from 'http'

function signJsonLDObjectWithoutAssertion (options: Parameters<typeof signJsonLDObject>[0]) {
  return signJsonLDObject({
    ...options,

    disableWorkerThreadAssertion: true
  })
}

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
  const json = readJsonSync(buildAbsoluteFixturePath('./ap-json/peertube/announce-without-context.json'))
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

function makeFollowRequest (to: { url: string }, by: { url: string, privateKey }) {
  const follow = {
    type: 'Follow',
    id: by.url + '/' + new Date().getTime(),
    actor: by.url,
    object: to.url
  }

  return makeSignedPOSTAPRequest({
    url: to.url + '/inbox',
    activity: follow,
    contextType: 'Follow',
    keyId: by.url,
    privateKey: by.privateKey
  })
}

describe('Test ActivityPub security', function () {
  let servers: PeerTubeServer[]
  let sqlCommands: SQLCommand[] = []

  let url: string

  const keys = readJsonSync(buildAbsoluteFixturePath('./ap-json/peertube/keys.json'))
  const invalidKeys = readJsonSync(buildAbsoluteFixturePath('./ap-json/peertube/invalid-keys.json'))
  const baseHttpSignature = () => ({
    keyId: 'acct:peertube@' + servers[1].host,
    key: keys.privateKey,
    headers: HTTP_SIGNATURE.HEADERS_TO_SIGN_WITH_PAYLOAD
  })

  async function buildRawBody () {
    return JSON.stringify(await activityPubContextify(getAnnounceWithoutContext(servers[1]), 'Announce', fakeContextFilter()))
  }

  // Our HTTP client always sets the host of the URL and the signature in the Signature header, so we need to build the request ourselves
  async function postRawRequest (options: {
    body: string
    host?: string
    contentType?: string
    signatureInAuthorization?: boolean
  }) {
    const { body, host = servers[0].host, contentType = 'application/activity+json', signatureInAuthorization = false } = options

    const headers: Record<string, string> = {
      'host': host,
      'date': new Date().toUTCString(),
      'digest': buildDigest(body),
      'content-type': contentType
    }

    await signAsDraftToRequest(
      { headers, method: 'POST', url: '/inbox' },
      { keyId: baseHttpSignature().keyId, privateKeyPem: keys.privateKey },
      HTTP_SIGNATURE.HEADERS_TO_SIGN_WITH_PAYLOAD
    )

    if (signatureInAuthorization) {
      headers['authorization'] = 'Signature ' + headers['Signature']
      delete headers['Signature']
    }

    return sendRawRequest(body, headers)
  }

  // Sign with the (created) parameter, that is not supported by our HTTP client
  async function postRequestSignedWithCreated (createdAt: Date | undefined) {
    const body = await buildRawBody()
    const created = createdAt ? Math.floor(createdAt.getTime() / 1000) : undefined
    const digest = buildDigest(body)

    const signingString = `(request-target): post /inbox\n(created): ${created}\nhost: ${servers[0].host}\ndigest: ${digest}`
    const signature = createSign('RSA-SHA256').update(signingString).sign(keys.privateKey, 'base64')

    const params = [
      `keyId="${baseHttpSignature().keyId}"`,
      `algorithm="rsa-sha256"`,
      `headers="(request-target) (created) host digest"`,
      // The signature parser truncates unquoted values
      created ? `created="${created}"` : undefined,
      `signature="${signature}"`
    ]

    return sendRawRequest(body, {
      'host': servers[0].host,
      'digest': digest,
      'content-type': 'application/activity+json',
      'signature': params.filter(p => !!p).join(',')
    })
  }

  function sendRawRequest (body: string, headers: Record<string, string>) {
    return new Promise<number>((resolve, reject) => {
      const { hostname, port } = new URL(url)

      const req = request({ hostname, port, path: '/inbox', method: 'POST', headers }, res => {
        res.resume()
        res.on('end', () => resolve(res.statusCode))
      })

      req.on('error', reject)
      req.end(body)
    })
  }

  async function postActivity (activity: any, created?: Date, alterSignedBody?: (body: any) => void) {
    const signer: any = { privateKey: keys.privateKey, url: servers[2].url + '/accounts/peertube' }
    const signedBody: any = await signAndContextify({
      byActor: signer,
      data: activity,
      contextType: 'Announce',
      contextFilter: fakeContextFilter(),
      signerFunction: (options: Parameters<typeof signJsonLDObject>[0]) => signJsonLDObjectWithoutAssertion({ ...options, created })
    })

    alterSignedBody?.(signedBody)

    const headers = buildGlobalHTTPHeaders(signedBody, buildDigest)

    try {
      await makePOSTAPRequest(url, signedBody, baseHttpSignature(), headers)

      return { fail: false }
    } catch (err) {
      return { fail: true, statusCode: err.statusCode, message: JSON.stringify(err.responseBody) }
    }
  }

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
      const body = await activityPubContextify(getAnnounceWithoutContext(servers[1]), 'Announce', fakeContextFilter())
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
      const body = await activityPubContextify(getAnnounceWithoutContext(servers[1]), 'Announce', fakeContextFilter())
      const headers = buildGlobalHTTPHeaders(body, buildDigest)
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

      const body = await activityPubContextify(getAnnounceWithoutContext(servers[1]), 'Announce', fakeContextFilter())
      const headers = buildGlobalHTTPHeaders(body, buildDigest)

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

      const body = await activityPubContextify(getAnnounceWithoutContext(servers[1]), 'Announce', fakeContextFilter())
      const headers = buildGlobalHTTPHeaders(body, buildDigest)

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
      expect(await postRequestSignedWithCreated(new Date())).to.equal(HttpStatusCode.NO_CONTENT_204)
    })

    it('Should fail with a too old (created) value', async function () {
      const createdAt = new Date(new Date().getTime() - (HTTP_SIGNATURE.CLOCK_SKEW_SECONDS + 60) * 1000)

      expect(await postRequestSignedWithCreated(createdAt)).to.equal(HttpStatusCode.FORBIDDEN_403)
    })

    it('Should fail with a signed (created) without value', async function () {
      expect(await postRequestSignedWithCreated(undefined)).to.equal(HttpStatusCode.FORBIDDEN_403)
    })

    it('Should succeed with a valid HTTP signature', async function () {
      const body = await activityPubContextify(getAnnounceWithoutContext(servers[1]), 'Announce', fakeContextFilter())
      const headers = buildGlobalHTTPHeaders(body, buildDigest)

      const { statusCode } = await makePOSTAPRequest(url, body, baseHttpSignature(), headers)
      expect(statusCode).to.equal(HttpStatusCode.NO_CONTENT_204)
    })

    it('Should succeed with a raw request for this instance', async function () {
      expect(await postRawRequest({ body: await buildRawBody() })).to.equal(HttpStatusCode.NO_CONTENT_204)
    })

    it('Should fail with a request signed for another host', async function () {
      const statusCode = await postRawRequest({ body: await buildRawBody(), host: 'other-instance.example.com' })

      expect(statusCode).to.equal(HttpStatusCode.FORBIDDEN_403)
    })

    it('Should fail with a signature in the Authorization header', async function () {
      const statusCode = await postRawRequest({ body: await buildRawBody(), signatureInAuthorization: true })

      expect(statusCode).to.equal(HttpStatusCode.FORBIDDEN_403)
    })

    it('Should fail with a non JSON content type', async function () {
      const statusCode = await postRawRequest({ body: await buildRawBody(), contentType: 'application/x-www-form-urlencoded' })

      expect(statusCode).to.equal(HttpStatusCode.UNSUPPORTED_MEDIA_TYPE_415)
    })

    it('Should reject a Collection with too many activities', async function () {
      const items = []

      for (let i = 0; i <= ACTIVITY_PUB.MAX_ACTIVITIES_PER_REQUEST; i++) {
        items.push({
          id: `${servers[1].url}/activities/${i}`,
          type: 'Like',
          actor: servers[1].url + '/accounts/peertube',
          object: servers[1].url + '/accounts/peertube'
        })
      }

      const body = await activityPubContextify(
        {
          type: 'OrderedCollection',
          // Matches the HTTP-signature actor so the forwarded (JSON-LD signature) codepath is not triggered
          actor: servers[1].url + '/accounts/peertube',
          totalItems: items.length,
          orderedItems: items
        },
        'Collection',
        fakeContextFilter()
      )

      const headers = buildGlobalHTTPHeaders(body, buildDigest)

      try {
        await makePOSTAPRequest(url, body, baseHttpSignature(), headers)
        expect(true, 'Did not throw').to.be.false
      } catch (err) {
        expect(err.statusCode).to.equal(HttpStatusCode.BAD_REQUEST_400)
      }
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

      const body = await activityPubContextify(getAnnounceWithoutContext(servers[1]), 'Announce', fakeContextFilter())
      const headers = buildGlobalHTTPHeaders(body, buildDigest)

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
      await setKeysOfServer(sqlCommands[0], servers[1].url, keys.publicKey, keys.privateKey)
      await setKeysOfServer(sqlCommands[1], servers[1].url, keys.publicKey, keys.privateKey)
      await setKeysOfServer(sqlCommands[2], servers[2].url, keys.publicKey, keys.privateKey)

      const to = { url: servers[0].url + '/accounts/peertube' }
      const by = { url: servers[2].url + '/accounts/peertube', privateKey: keys.privateKey }
      await makeFollowRequest(to, by)
    })

    it('Should fail with bad keys', async function () {
      await setKeysOfServer(sqlCommands[0], servers[2].url, invalidKeys.publicKey, invalidKeys.privateKey)
      await setKeysOfServer(sqlCommands[2], servers[2].url, invalidKeys.publicKey, invalidKeys.privateKey)

      const body = getAnnounceWithoutContext(servers[1])
      body.actor = servers[2].url + '/accounts/peertube'

      const signer: any = { privateKey: invalidKeys.privateKey, url: servers[2].url + '/accounts/peertube' }
      const signedBody = await signAndContextify({
        byActor: signer,
        data: body,
        contextType: 'Announce',
        contextFilter: fakeContextFilter(),
        signerFunction: signJsonLDObjectWithoutAssertion
      })

      const headers = buildGlobalHTTPHeaders(signedBody, buildDigest)

      try {
        await makePOSTAPRequest(url, signedBody, baseHttpSignature(), headers)
        expect(true, 'Did not throw').to.be.false
      } catch (err) {
        expect(err.statusCode).to.equal(HttpStatusCode.FORBIDDEN_403)
      }
    })

    it('Should fail with an altered body', async function () {
      await setKeysOfServer(sqlCommands[0], servers[2].url, keys.publicKey, keys.privateKey)
      await setKeysOfServer(sqlCommands[0], servers[2].url, keys.publicKey, keys.privateKey)

      const body = getAnnounceWithoutContext(servers[1])
      body.actor = servers[2].url + '/accounts/peertube'

      const signer: any = { privateKey: keys.privateKey, url: servers[2].url + '/accounts/peertube' }
      const signedBody: any = await signAndContextify({
        byActor: signer,
        data: body,
        contextType: 'Announce',
        contextFilter: fakeContextFilter(),
        signerFunction: signJsonLDObjectWithoutAssertion
      })

      signedBody.actor = servers[2].url + '/account/peertube'

      const headers = buildGlobalHTTPHeaders(signedBody, buildDigest)

      try {
        await makePOSTAPRequest(url, signedBody, baseHttpSignature(), headers)
        expect(true, 'Did not throw').to.be.false
      } catch (err) {
        expect(err.statusCode).to.equal(HttpStatusCode.FORBIDDEN_403)
      }
    })

    it('Should fail with an activity using @graph payload', async function () {
      const activity: any = {
        'id': 'https://victim.example/users/alice/statuses/123/activity',
        'type': 'Announce',
        'actor': servers[2].url + '/accounts/peertube',
        'published': '2026-03-30T07:18:30Z',
        'to': [ 'https://www.w3.org/ns/activitystreams#Public' ],
        'cc': [ 'https://victim.example/users/alice/followers' ],
        'object': 'https://target.example/users/bob/statuses/456',
        '@graph': [
          {
            id: 'https://victim.example/users/alice#announces/123/undo',
            type: 'Undo',
            actor: servers[2].url + '/accounts/peertube',
            to: [ 'https://www.w3.org/ns/activitystreams#Public' ],
            object: 'https://victim.example/users/alice/statuses/123/activity'
          }
        ]
      }

      const { fail, statusCode } = await postActivity(activity)
      expect(fail).to.be.true
      expect(statusCode).to.equal(HttpStatusCode.FORBIDDEN_403)
    })

    it('Should fail with an activity using @reverse payload', async function () {
      const activity: any = {
        'id': 'https://victim.example/users/alice/statuses/123/activity',
        'type': 'Announce',
        'actor': servers[2].url + '/accounts/peertube',
        'published': '2026-03-30T07:18:30Z',
        'to': [ 'https://www.w3.org/ns/activitystreams#Public' ],
        'cc': [ 'https://victim.example/users/alice/followers' ],
        'object': 'https://target.example/users/bob/statuses/456',
        '@reverse': {
          object: {
            id: 'https://victim.example/users/alice#announces/123/undo',
            type: 'Undo',
            actor: servers[2].url + '/accounts/peertube',
            to: [ 'https://www.w3.org/ns/activitystreams#Public' ]
          }
        }
      }

      const { fail, statusCode } = await postActivity(activity)
      expect(fail).to.be.true
      expect(statusCode).to.equal(HttpStatusCode.FORBIDDEN_403)
    })

    it('Should fail with an activity using @included payload', async function () {
      const activity: any = {
        '@context': 'https://www.w3.org/ns/activitystreams',
        'id': 'https://alice.example/notes/42/activity',
        'type': 'Create',
        'actor': servers[2].url + '/accounts/peertube',

        'cc': 'https://www.w3.org/ns/activitystreams#Public',
        'object': {
          id: 'https://alice.example/notes/42',
          type: 'Note',
          attributedTo: 'https://alice.example/actors/1',
          cc: 'https://www.w3.org/ns/activitystreams#Public',
          content: 'Welcome to Fediverse!'
        },
        '@included': {
          id: 'https://alice.example/notes/42/activity',
          to: 'https://bob.example/actors/1',
          object: {
            id: 'https://alice.example/notes/42',
            to: 'https://bob.example/actors/1',
            inReplyTo: 'https://bob.example/notes/1'
          }
        }
      }

      const { fail, statusCode } = await postActivity(activity)
      expect(fail).to.be.true
      expect(statusCode).to.equal(HttpStatusCode.FORBIDDEN_403)
    })

    it('Should fail with an activity using aliased @included payload', async function () {
      const activity: any = {
        '@context': [ 'https://www.w3.org/ns/activitystreams', { included: '@included' } ],
        'id': 'https://alice.example/notes/42/activity',
        'type': 'Create',
        'actor': servers[2].url + '/accounts/peertube',
        'cc': 'https://www.w3.org/ns/activitystreams#Public',
        'object': {
          id: 'https://alice.example/notes/42',
          type: 'Note',
          attributedTo: 'https://alice.example/actors/1',
          cc: 'https://www.w3.org/ns/activitystreams#Public',
          content: 'Welcome to Fediverse!'
        },
        'included': {
          id: 'https://alice.example/notes/42/activity',
          to: 'https://bob.example/actors/1',
          object: {
            id: 'https://alice.example/notes/42',
            to: 'https://bob.example/actors/1',
            inReplyTo: 'https://bob.example/notes/1'
          }
        }
      }

      const { fail, statusCode } = await postActivity(activity)
      expect(fail).to.be.true
      expect(statusCode).to.equal(HttpStatusCode.FORBIDDEN_403)
    })

    it('Should fail with an activity using inner @included payload', async function () {
      const activity: any = {
        '@context': [ 'https://www.w3.org/ns/activitystreams', { included: '@included' } ],
        'id': 'https://alice.example/notes/42/activity',
        'type': 'Create',
        'actor': servers[2].url + '/accounts/peertube',
        'cc': 'https://www.w3.org/ns/activitystreams#Public',
        'object': {
          id: 'https://alice.example/notes/42',
          type: 'Note',
          attributedTo: 'https://alice.example/actors/1',
          cc: 'https://www.w3.org/ns/activitystreams#Public',
          content: 'Welcome to Fediverse!',
          included: {
            id: 'https://alice.example/notes/42/activity',
            to: 'https://bob.example/actors/1',
            object: {
              id: 'https://alice.example/notes/42',
              to: 'https://bob.example/actors/1',
              inReplyTo: 'https://bob.example/notes/1'
            }
          }
        }
      }

      const { fail, statusCode } = await postActivity(activity)
      expect(fail).to.be.true
      expect(statusCode).to.equal(HttpStatusCode.FORBIDDEN_403)
    })

    it('Should succeed with a valid signature', async function () {
      {
        const activity = getAnnounceWithoutContext(servers[1])

        const { fail } = await postActivity(activity)
        expect(fail).to.be.false
      }

      {
        const activity: any = {
          '@context': 'https://www.w3.org/ns/activitystreams',
          'id': 'https://alice.example/notes/42/activity',
          'type': 'Create',
          'actor': servers[2].url + '/accounts/peertube',
          'cc': 'https://www.w3.org/ns/activitystreams#Public',
          'object': {
            id: 'https://alice.example/notes/42',
            type: 'Note',
            attributedTo: 'https://alice.example/actors/1',
            cc: 'https://www.w3.org/ns/activitystreams#Public',
            content: 'Welcome to Fediverse!'
          }
        }

        const { fail } = await postActivity(activity)
        expect(fail).to.be.false
      }
    })

    it('Should fail with a too old signature', async function () {
      const created = new Date(new Date().getTime() - ACTIVITY_PUB.CHECK_JSON_LD_SIGNATURE.MAX_AGE - 60000)

      const activity = getAnnounceWithoutContext(servers[1])
      activity.actor = servers[2].url + '/accounts/peertube'

      const { fail, statusCode, message } = await postActivity(activity, created)

      expect(fail).to.be.true
      expect(statusCode).to.equal(HttpStatusCode.FORBIDDEN_403)
      expect(message).to.contain('too old')
    })

    it('Should fail with a too old signature hidden by a custom signature context', async function () {
      const created = new Date(new Date().getTime() - ACTIVITY_PUB.CHECK_JSON_LD_SIGNATURE.MAX_AGE - 60000)

      const activity = getAnnounceWithoutContext(servers[1])
      activity.actor = servers[2].url + '/accounts/peertube'

      const { fail, statusCode } = await postActivity(activity, created, body => {
        body.signature = {
          'type': body.signature.type,
          '@context': [ 'https://w3id.org/security/v1', { created: '@index' } ],
          'creator': body.signature.creator,
          'created': new Date().toISOString(),
          'http://purl.org/dc/terms/created': { '@value': created.toISOString(), '@type': 'http://www.w3.org/2001/XMLSchema#dateTime' },
          'signatureValue': body.signature.signatureValue
        }
      })

      expect(fail).to.be.true
      expect(statusCode).to.equal(HttpStatusCode.FORBIDDEN_403)
    })

    it('Should fail with a forwarded actor update', async function () {
      const actor = servers[2].url + '/accounts/peertube'

      const { fail, statusCode, message } = await postActivity({
        type: 'Update',
        id: actor + '/updates/1',
        actor,
        to: [ 'https://www.w3.org/ns/activitystreams#Public' ],
        object: { type: 'Application', id: actor, preferredUsername: 'peertube' }
      })

      expect(fail).to.be.true
      expect(statusCode).to.equal(HttpStatusCode.FORBIDDEN_403)
      expect(message).to.contain('cannot be forwarded')
    })

    it('Should fail with a body bigger than the JSON-LD signature check limit', async function () {
      const activity: any = {
        '@context': 'https://www.w3.org/ns/activitystreams',
        'id': 'https://alice.example/notes/43/activity',
        'type': 'Create',
        'actor': servers[2].url + '/accounts/peertube',
        'cc': 'https://www.w3.org/ns/activitystreams#Public',
        'object': {
          id: 'https://alice.example/notes/43',
          type: 'Note',
          attributedTo: 'https://alice.example/actors/1',
          cc: 'https://www.w3.org/ns/activitystreams#Public',
          // Stay under the express.json() 500kb body limit, but above the JSON-LD signature check limit
          content: 'a'.repeat(300 * 1024)
        }
      }

      const { fail, statusCode } = await postActivity(activity)
      expect(fail).to.be.true
      expect(statusCode).to.equal(HttpStatusCode.FORBIDDEN_403)
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
      const signedBody = await signAndContextify({
        byActor: signer,
        data: body,
        contextType: 'Announce',
        contextFilter: fakeContextFilter(),
        signerFunction: signJsonLDObjectWithoutAssertion
      })

      const headers = buildGlobalHTTPHeaders(signedBody, buildDigest)

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
