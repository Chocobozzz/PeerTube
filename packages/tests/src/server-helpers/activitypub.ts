/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { buildAbsoluteFixturePath } from '@peertube/peertube-node-utils'
import { signAndContextify } from '@peertube/peertube-server/core/helpers/activity-pub-utils.js'
import { isHTTPSignatureVerified, parseHTTPSignature } from '@peertube/peertube-server/core/helpers/peertube-crypto.js'
import { compactJSONLDAndCheckSignature, signJsonLDObject } from '@peertube/peertube-server/core/helpers/peertube-jsonld.js'
import { expect } from 'chai'
import { readJsonSync } from 'fs-extra/esm'
import cloneDeep from 'lodash-es/cloneDeep.js'

function buildRequestStub (): any {
  return { }
}

function signJsonLDObjectWithoutAssertion (options: Parameters<typeof signJsonLDObject>[0]) {
  return signJsonLDObject({
    ...options,

    disableWorkerThreadAssertion: true
  })
}

function fakeFilter () {
  return (data: any) => Promise.resolve(data)
}

function fakeExpressReq (body: any) {
  return { body }
}

describe('Test activity pub helpers', function () {

  describe('When checking the Linked Signature', function () {

    it('Should fail with an invalid Mastodon signature', async function () {
      const body = readJsonSync(buildAbsoluteFixturePath('./ap-json/mastodon/create-bad-signature.json'))
      const publicKey = readJsonSync(buildAbsoluteFixturePath('./ap-json/mastodon/public-key.json')).publicKey
      const fromActor = { publicKey, url: 'http://localhost:9002/accounts/peertube' }

      const result = await compactJSONLDAndCheckSignature(fromActor as any, fakeExpressReq(body))

      expect(result).to.be.false
    })

    it('Should fail with an invalid public key', async function () {
      const body = readJsonSync(buildAbsoluteFixturePath('./ap-json/mastodon/create.json'))
      const publicKey = readJsonSync(buildAbsoluteFixturePath('./ap-json/mastodon/bad-public-key.json')).publicKey
      const fromActor = { publicKey, url: 'http://localhost:9002/accounts/peertube' }

      const result = await compactJSONLDAndCheckSignature(fromActor as any, fakeExpressReq(body))

      expect(result).to.be.false
    })

    it('Should succeed with a valid Mastodon signature', async function () {
      const body = readJsonSync(buildAbsoluteFixturePath('./ap-json/mastodon/create.json'))
      const publicKey = readJsonSync(buildAbsoluteFixturePath('./ap-json/mastodon/public-key.json')).publicKey
      const fromActor = { publicKey, url: 'http://localhost:9002/accounts/peertube' }

      const result = await compactJSONLDAndCheckSignature(fromActor as any, fakeExpressReq(body))

      expect(result).to.be.true
    })

    it('Should fail with an invalid PeerTube signature', async function () {
      const keys = readJsonSync(buildAbsoluteFixturePath('./ap-json/peertube/invalid-keys.json'))
      const body = readJsonSync(buildAbsoluteFixturePath('./ap-json/peertube/announce-without-context.json'))

      const actorSignature = { url: 'http://localhost:9002/accounts/peertube', privateKey: keys.privateKey }
      const signedBody = await signAndContextify({
        byActor: actorSignature as any,
        data: body,
        contextType: 'Announce',
        contextFilter: fakeFilter(),
        signerFunction: signJsonLDObjectWithoutAssertion
      })

      const fromActor = { publicKey: keys.publicKey, url: 'http://localhost:9002/accounts/peertube' }
      const result = await compactJSONLDAndCheckSignature(fromActor as any, fakeExpressReq(signedBody))

      expect(result).to.be.false
    })

    it('Should succeed with a valid PeerTube signature', async function () {
      const keys = readJsonSync(buildAbsoluteFixturePath('./ap-json/peertube/keys.json'))
      const body = readJsonSync(buildAbsoluteFixturePath('./ap-json/peertube/announce-without-context.json'))

      const actorSignature = { url: 'http://localhost:9002/accounts/peertube', privateKey: keys.privateKey }
      const signedBody = await signAndContextify({
        byActor: actorSignature as any,
        data: body,
        contextType: 'Announce',
        contextFilter: fakeFilter(),
        signerFunction: signJsonLDObjectWithoutAssertion
      })

      const fromActor = { publicKey: keys.publicKey, url: 'http://localhost:9002/accounts/peertube' }
      const result = await compactJSONLDAndCheckSignature(fromActor as any, fakeExpressReq(signedBody))

      expect(result).to.be.true
    })
  })

  describe('When checking HTTP signature', function () {
    it('Should fail with an invalid http signature', async function () {
      const req = buildRequestStub()
      req.method = 'POST'
      req.url = '/accounts/ronan/inbox'

      const mastodonObject = cloneDeep(readJsonSync(buildAbsoluteFixturePath('./ap-json/mastodon/bad-http-signature.json')))
      req.body = mastodonObject.body
      req.headers = mastodonObject.headers

      const parsed = parseHTTPSignature(req, 3600 * 1000 * 365 * 10)
      const publicKey = readJsonSync(buildAbsoluteFixturePath('./ap-json/mastodon/public-key.json')).publicKey

      const actor = { publicKey }
      const verified = isHTTPSignatureVerified(parsed, actor as any)

      expect(verified).to.be.false
    })

    it('Should fail with an invalid public key', async function () {
      const req = buildRequestStub()
      req.method = 'POST'
      req.url = '/accounts/ronan/inbox'

      const mastodonObject = cloneDeep(readJsonSync(buildAbsoluteFixturePath('./ap-json/mastodon/http-signature.json')))
      req.body = mastodonObject.body
      req.headers = mastodonObject.headers

      const parsed = parseHTTPSignature(req, 3600 * 1000 * 365 * 10)
      const publicKey = readJsonSync(buildAbsoluteFixturePath('./ap-json/mastodon/bad-public-key.json')).publicKey

      const actor = { publicKey }
      const verified = isHTTPSignatureVerified(parsed, actor as any)

      expect(verified).to.be.false
    })

    it('Should fail because of clock skew', async function () {
      const req = buildRequestStub()
      req.method = 'POST'
      req.url = '/accounts/ronan/inbox'

      const mastodonObject = cloneDeep(readJsonSync(buildAbsoluteFixturePath('./ap-json/mastodon/http-signature.json')))
      req.body = mastodonObject.body
      req.headers = mastodonObject.headers

      let errored = false
      try {
        parseHTTPSignature(req)
      } catch {
        errored = true
      }

      expect(errored).to.be.true
    })

    it('Should with a scheme', async function () {
      const req = buildRequestStub()
      req.method = 'POST'
      req.url = '/accounts/ronan/inbox'

      const mastodonObject = cloneDeep(readJsonSync(buildAbsoluteFixturePath('./ap-json/mastodon/http-signature.json')))
      req.body = mastodonObject.body
      req.headers = mastodonObject.headers
      req.headers = 'Signature ' + mastodonObject.headers

      let errored = false
      try {
        parseHTTPSignature(req, 3600 * 1000 * 365 * 10)
      } catch {
        errored = true
      }

      expect(errored).to.be.true
    })

    it('Should succeed with a valid signature', async function () {
      const req = buildRequestStub()
      req.method = 'POST'
      req.url = '/accounts/ronan/inbox'

      const mastodonObject = cloneDeep(readJsonSync(buildAbsoluteFixturePath('./ap-json/mastodon/http-signature.json')))
      req.body = mastodonObject.body
      req.headers = mastodonObject.headers

      const parsed = parseHTTPSignature(req, 3600 * 1000 * 365 * 10)
      const publicKey = readJsonSync(buildAbsoluteFixturePath('./ap-json/mastodon/public-key.json')).publicKey

      const actor = { publicKey }
      const verified = isHTTPSignatureVerified(parsed, actor as any)

      expect(verified).to.be.true
    })

  })

})
