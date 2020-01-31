/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import { expect } from 'chai'
import { buildRequestStub } from '../../../../shared/extra-utils/miscs/stubs'
import { isHTTPSignatureVerified, isJsonLDSignatureVerified, parseHTTPSignature } from '../../../helpers/peertube-crypto'
import { cloneDeep } from 'lodash'
import { buildSignedActivity } from '../../../helpers/activitypub'

describe('Test activity pub helpers', function () {
  describe('When checking the Linked Signature', function () {

    it('Should fail with an invalid Mastodon signature', async function () {
      const body = require('./json/mastodon/create-bad-signature.json')
      const publicKey = require('./json/mastodon/public-key.json').publicKey
      const fromActor = { publicKey, url: 'http://localhost:9002/accounts/peertube' }

      const result = await isJsonLDSignatureVerified(fromActor as any, body)

      expect(result).to.be.false
    })

    it('Should fail with an invalid public key', async function () {
      const body = require('./json/mastodon/create.json')
      const publicKey = require('./json/mastodon/bad-public-key.json').publicKey
      const fromActor = { publicKey, url: 'http://localhost:9002/accounts/peertube' }

      const result = await isJsonLDSignatureVerified(fromActor as any, body)

      expect(result).to.be.false
    })

    it('Should succeed with a valid Mastodon signature', async function () {
      const body = require('./json/mastodon/create.json')
      const publicKey = require('./json/mastodon/public-key.json').publicKey
      const fromActor = { publicKey, url: 'http://localhost:9002/accounts/peertube' }

      const result = await isJsonLDSignatureVerified(fromActor as any, body)

      expect(result).to.be.true
    })

    it('Should fail with an invalid PeerTube signature', async function () {
      const keys = require('./json/peertube/invalid-keys.json')
      const body = require('./json/peertube/announce-without-context.json')

      const actorSignature = { url: 'http://localhost:9002/accounts/peertube', privateKey: keys.privateKey }
      const signedBody = await buildSignedActivity(actorSignature as any, body)

      const fromActor = { publicKey: keys.publicKey, url: 'http://localhost:9002/accounts/peertube' }
      const result = await isJsonLDSignatureVerified(fromActor as any, signedBody)

      expect(result).to.be.false
    })

    it('Should succeed with a valid PeerTube signature', async function () {
      const keys = require('./json/peertube/keys.json')
      const body = require('./json/peertube/announce-without-context.json')

      const actorSignature = { url: 'http://localhost:9002/accounts/peertube', privateKey: keys.privateKey }
      const signedBody = await buildSignedActivity(actorSignature as any, body)

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

      const mastodonObject = cloneDeep(require('./json/mastodon/bad-http-signature.json'))
      req.body = mastodonObject.body
      req.headers = mastodonObject.headers

      const parsed = parseHTTPSignature(req, 3600 * 1000 * 365 * 10)
      const publicKey = require('./json/mastodon/public-key.json').publicKey

      const actor = { publicKey }
      const verified = isHTTPSignatureVerified(parsed, actor as any)

      expect(verified).to.be.false
    })

    it('Should fail with an invalid public key', async function () {
      const req = buildRequestStub()
      req.method = 'POST'
      req.url = '/accounts/ronan/inbox'

      const mastodonObject = cloneDeep(require('./json/mastodon/http-signature.json'))
      req.body = mastodonObject.body
      req.headers = mastodonObject.headers

      const parsed = parseHTTPSignature(req, 3600 * 1000 * 365 * 10)
      const publicKey = require('./json/mastodon/bad-public-key.json').publicKey

      const actor = { publicKey }
      const verified = isHTTPSignatureVerified(parsed, actor as any)

      expect(verified).to.be.false
    })

    it('Should fail because of clock skew', async function () {
      const req = buildRequestStub()
      req.method = 'POST'
      req.url = '/accounts/ronan/inbox'

      const mastodonObject = cloneDeep(require('./json/mastodon/http-signature.json'))
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

      const mastodonObject = cloneDeep(require('./json/mastodon/http-signature.json'))
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

      const mastodonObject = cloneDeep(require('./json/mastodon/http-signature.json'))
      req.body = mastodonObject.body
      req.headers = mastodonObject.headers

      const parsed = parseHTTPSignature(req, 3600 * 1000 * 365 * 10)
      const publicKey = require('./json/mastodon/public-key.json').publicKey

      const actor = { publicKey }
      const verified = isHTTPSignatureVerified(parsed, actor as any)

      expect(verified).to.be.true
    })

  })

})
