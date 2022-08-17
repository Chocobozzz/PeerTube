/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { cloneDeep } from 'lodash'
import { signAndContextify } from '@server/lib/activitypub/send'
import { buildRequestStub } from '@server/tests/shared'
import { buildAbsoluteFixturePath } from '@shared/core-utils'
import { isHTTPSignatureVerified, isJsonLDSignatureVerified, parseHTTPSignature } from '../../../helpers/peertube-crypto'

describe('Test activity pub helpers', function () {

  describe('When checking the Linked Signature', function () {

    it('Should fail with an invalid Mastodon signature', async function () {
      const body = require(buildAbsoluteFixturePath('./ap-json/mastodon/create-bad-signature.json'))
      const publicKey = require(buildAbsoluteFixturePath('./ap-json/mastodon/public-key.json')).publicKey
      const fromActor = { publicKey, url: 'http://localhost:9002/accounts/peertube' }

      const result = await isJsonLDSignatureVerified(fromActor as any, body)

      expect(result).to.be.false
    })

    it('Should fail with an invalid public key', async function () {
      const body = require(buildAbsoluteFixturePath('./ap-json/mastodon/create.json'))
      const publicKey = require(buildAbsoluteFixturePath('./ap-json/mastodon/bad-public-key.json')).publicKey
      const fromActor = { publicKey, url: 'http://localhost:9002/accounts/peertube' }

      const result = await isJsonLDSignatureVerified(fromActor as any, body)

      expect(result).to.be.false
    })

    it('Should succeed with a valid Mastodon signature', async function () {
      const body = require(buildAbsoluteFixturePath('./ap-json/mastodon/create.json'))
      const publicKey = require(buildAbsoluteFixturePath('./ap-json/mastodon/public-key.json')).publicKey
      const fromActor = { publicKey, url: 'http://localhost:9002/accounts/peertube' }

      const result = await isJsonLDSignatureVerified(fromActor as any, body)

      expect(result).to.be.true
    })

    it('Should fail with an invalid PeerTube signature', async function () {
      const keys = require(buildAbsoluteFixturePath('./ap-json/peertube/invalid-keys.json'))
      const body = require(buildAbsoluteFixturePath('./ap-json/peertube/announce-without-context.json'))

      const actorSignature = { url: 'http://localhost:9002/accounts/peertube', privateKey: keys.privateKey }
      const signedBody = await signAndContextify(actorSignature as any, body, 'Announce')

      const fromActor = { publicKey: keys.publicKey, url: 'http://localhost:9002/accounts/peertube' }
      const result = await isJsonLDSignatureVerified(fromActor as any, signedBody)

      expect(result).to.be.false
    })

    it('Should succeed with a valid PeerTube signature', async function () {
      const keys = require(buildAbsoluteFixturePath('./ap-json/peertube/keys.json'))
      const body = require(buildAbsoluteFixturePath('./ap-json/peertube/announce-without-context.json'))

      const actorSignature = { url: 'http://localhost:9002/accounts/peertube', privateKey: keys.privateKey }
      const signedBody = await signAndContextify(actorSignature as any, body, 'Announce')

      const fromActor = { publicKey: keys.publicKey, url: 'http://localhost:9002/accounts/peertube' }
      const result = await isJsonLDSignatureVerified(fromActor as any, signedBody)

      expect(result).to.be.true
    })
  })

  describe('When checking HTTP signature', function () {
    it('Should fail with an invalid http signature', async function () {
      const req = buildRequestStub()
      req.method = 'POST'
      req.url = '/accounts/ronan/inbox'

      const mastodonObject = cloneDeep(require(buildAbsoluteFixturePath('./ap-json/mastodon/bad-http-signature.json')))
      req.body = mastodonObject.body
      req.headers = mastodonObject.headers

      const parsed = parseHTTPSignature(req, 3600 * 1000 * 365 * 10)
      const publicKey = require(buildAbsoluteFixturePath('./ap-json/mastodon/public-key.json')).publicKey

      const actor = { publicKey }
      const verified = isHTTPSignatureVerified(parsed, actor as any)

      expect(verified).to.be.false
    })

    it('Should fail with an invalid public key', async function () {
      const req = buildRequestStub()
      req.method = 'POST'
      req.url = '/accounts/ronan/inbox'

      const mastodonObject = cloneDeep(require(buildAbsoluteFixturePath('./ap-json/mastodon/http-signature.json')))
      req.body = mastodonObject.body
      req.headers = mastodonObject.headers

      const parsed = parseHTTPSignature(req, 3600 * 1000 * 365 * 10)
      const publicKey = require(buildAbsoluteFixturePath('./ap-json/mastodon/bad-public-key.json')).publicKey

      const actor = { publicKey }
      const verified = isHTTPSignatureVerified(parsed, actor as any)

      expect(verified).to.be.false
    })

    it('Should fail because of clock skew', async function () {
      const req = buildRequestStub()
      req.method = 'POST'
      req.url = '/accounts/ronan/inbox'

      const mastodonObject = cloneDeep(require(buildAbsoluteFixturePath('./ap-json/mastodon/http-signature.json')))
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

      const mastodonObject = cloneDeep(require(buildAbsoluteFixturePath('./ap-json/mastodon/http-signature.json')))
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

      const mastodonObject = cloneDeep(require(buildAbsoluteFixturePath('./ap-json/mastodon/http-signature.json')))
      req.body = mastodonObject.body
      req.headers = mastodonObject.headers

      const parsed = parseHTTPSignature(req, 3600 * 1000 * 365 * 10)
      const publicKey = require(buildAbsoluteFixturePath('./ap-json/mastodon/public-key.json')).publicKey

      const actor = { publicKey }
      const verified = isHTTPSignatureVerified(parsed, actor as any)

      expect(verified).to.be.true
    })

  })

})
