/* oxlint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { buildAbsoluteFixturePath } from '@peertube/peertube-node-utils'
import { isActivityPubContentType, signAndContextify } from '@peertube/peertube-server/core/helpers/activity-pub-utils.js'
import { isHTTPSignatureVerified, parseHTTPSignature } from '@peertube/peertube-server/core/helpers/peertube-crypto.js'
import {
  addIntegrityProof,
  canonicalizeJSON,
  ed25519PublicKeyFromMultibase,
  ed25519PublicKeyToMultibase,
  getSupportedIntegrityProofActorUrl,
  isIntegrityProofVerified
} from '@peertube/peertube-server/core/helpers/peertube-integrity-proof.js'
import { compactJSONLDAndCheckSignature, signJsonLDObject } from '@peertube/peertube-server/core/helpers/peertube-jsonld.js'
import { fakeContextFilter } from '@tests/shared/requests.js'
import { expect } from 'chai'
import { createPublicKey, generateKeyPairSync } from 'crypto'
import { readJsonSync } from 'fs-extra/esm'
import cloneDeep from 'lodash-es/cloneDeep.js'

function buildRequestStub (): any {
  return {}
}

function signJsonLDObjectWithoutAssertion (options: Parameters<typeof signJsonLDObject>[0]) {
  return signJsonLDObject({
    ...options,

    disableWorkerThreadAssertion: true
  })
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
        contextFilter: fakeContextFilter(),
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
        contextFilter: fakeContextFilter(),
        signerFunction: signJsonLDObjectWithoutAssertion
      })

      const fromActor = { publicKey: keys.publicKey, url: 'http://localhost:9002/accounts/peertube' }
      const result = await compactJSONLDAndCheckSignature(fromActor as any, fakeExpressReq(signedBody))

      expect(result).to.be.true
    })
  })

  describe('When checking FEP-8b32 Object Integrity Proofs', function () {
    // Test vectors from https://codeberg.org/fediverse/fep/src/branch/main/fep/8b32/fep-8b32.feature
    // Secret key z3u2en7t5LR2WtQH5PfFqMqwVHBeXouLzo6haApm8XHqvjxq converted to PEM
    const vectorPrivateKey = '-----BEGIN PRIVATE KEY-----\n' +
      'MC4CAQAwBQYDK2VwBCIEIMlu+eoQxeQUxHFyOv+d5yw1+ltw+ul+iDLsrH0uK47W\n' +
      '-----END PRIVATE KEY-----\n'
    const vectorPublicKeyMultibase = 'z6MkrJVnaZkeFzdQyMZu1cgjg7k1pZZ6pvBQ7XJPt4swbTQ2'
    const vectorProofValue = 'z42ffGu6AUKPCFcFPiabmUvnGLPJzC7e4DGWC52NUasSSH37UMa9c58tdgVszUcZfytxa4fQ5TYHaJENCxUDe9SdL'

    function buildVectorDocument () {
      return {
        '@context': [ 'https://www.w3.org/ns/activitystreams', 'https://w3id.org/security/data-integrity/v2' ],
        'id': 'https://server.example/activities/1',
        'type': 'Create',
        'actor': 'https://server.example/users/alice',
        'object': {
          id: 'https://server.example/objects/1',
          type: 'Note',
          attributedTo: 'https://server.example/users/alice',
          content: 'Hello world',
          location: {
            type: 'Place',
            longitude: -71.184902,
            latitude: 25.273962
          }
        }
      }
    }

    function signVectorDocument () {
      return addIntegrityProof({
        data: buildVectorDocument(),
        privateKey: vectorPrivateKey,
        verificationMethod: 'https://server.example/users/alice#ed25519-key',
        created: new Date('2023-02-24T23:36:38Z')
      })
    }

    function generateEd25519Keys () {
      return generateKeyPairSync('ed25519', {
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
      })
    }

    it('Should canonicalize a document using JCS', async function () {
      expect(canonicalizeJSON(buildVectorDocument())).to.equal(
        '{"@context":["https://www.w3.org/ns/activitystreams","https://w3id.org/security/data-integrity/v2"],' +
          '"actor":"https://server.example/users/alice","id":"https://server.example/activities/1",' +
          '"object":{"attributedTo":"https://server.example/users/alice","content":"Hello world","id":"https://server.example/objects/1",' +
          '"location":{"latitude":25.273962,"longitude":-71.184902,"type":"Place"},"type":"Note"},"type":"Create"}'
      )
    })

    it('Should convert Ed25519 public keys from/to multibase', async function () {
      const publicKey = ed25519PublicKeyFromMultibase(vectorPublicKeyMultibase)

      expect(publicKey).to.equal(createPublicKey(vectorPrivateKey).export({ format: 'pem', type: 'spki' }))
      expect(ed25519PublicKeyToMultibase(publicKey)).to.equal(vectorPublicKeyMultibase)

      expect(ed25519PublicKeyFromMultibase('zabc')).to.be.undefined
      expect(ed25519PublicKeyFromMultibase('z' + '1'.repeat(100))).to.be.undefined
      // Not an Ed25519 multicodec
      expect(ed25519PublicKeyFromMultibase('zQ3shokFTS3brHcDQrn82RUDfCZESWL1ZdCEJwekUDPQiYBme')).to.be.undefined
      expect(ed25519PublicKeyFromMultibase(vectorPublicKeyMultibase.substring(1))).to.be.undefined
    })

    it('Should sign a document using the eddsa-jcs-2022 cryptosuite', async function () {
      const signed = signVectorDocument()

      expect(signed.proof).to.deep.equal({
        '@context': [ 'https://www.w3.org/ns/activitystreams', 'https://w3id.org/security/data-integrity/v2' ],
        'type': 'DataIntegrityProof',
        'cryptosuite': 'eddsa-jcs-2022',
        'verificationMethod': 'https://server.example/users/alice#ed25519-key',
        'proofPurpose': 'assertionMethod',
        'proofValue': vectorProofValue,
        'created': '2023-02-24T23:36:38Z'
      })
    })

    it('Should verify a valid proof', async function () {
      const publicKey = ed25519PublicKeyFromMultibase(vectorPublicKeyMultibase)

      expect(isIntegrityProofVerified({ data: signVectorDocument(), publicKey })).to.be.true
      expect(getSupportedIntegrityProofActorUrl(signVectorDocument())).to.equal('https://server.example/users/alice')

      // Legacy JSON-LD signature is ignored
      expect(isIntegrityProofVerified({ data: { ...signVectorDocument(), signature: { type: 'RsaSignature2017' } }, publicKey })).to.be.true
    })

    it('Should fail to verify an invalid proof', async function () {
      const publicKey = ed25519PublicKeyFromMultibase(vectorPublicKeyMultibase)

      {
        const signed = signVectorDocument()
        signed.object.content = 'Hello evil world'

        expect(isIntegrityProofVerified({ data: signed, publicKey })).to.be.false
      }

      {
        const signed = signVectorDocument()
        signed.proof.created = '2023-02-24T23:36:39Z'

        expect(isIntegrityProofVerified({ data: signed, publicKey })).to.be.false
      }

      {
        const signed = signVectorDocument()
        signed['@context'] = [ 'https://www.w3.org/ns/activitystreams' ]

        expect(isIntegrityProofVerified({ data: signed, publicKey })).to.be.false
      }

      {
        const signed = signVectorDocument()
        signed.proof.proofValue = 'z' + 'A'.repeat(200)

        expect(isIntegrityProofVerified({ data: signed, publicKey })).to.be.false
        expect(getSupportedIntegrityProofActorUrl(signed)).to.be.undefined
      }

      {
        const signed = signVectorDocument()
        signed.proof.expires = '2024-02-24T23:36:39Z'

        expect(isIntegrityProofVerified({ data: signed, publicKey })).to.be.false
        // Expired proofs must be ignored
        expect(getSupportedIntegrityProofActorUrl(signed)).to.be.undefined
      }

      {
        const signed: any = signVectorDocument()
        signed.proof.cryptosuite = 'eddsa-rdfc-2022'

        expect(isIntegrityProofVerified({ data: signed, publicKey })).to.be.false
        expect(getSupportedIntegrityProofActorUrl(signed)).to.be.undefined
      }

      expect(isIntegrityProofVerified({ data: signVectorDocument(), publicKey: generateEd25519Keys().publicKey })).to.be.false
      expect(isIntegrityProofVerified({ data: buildVectorDocument(), publicKey })).to.be.false
    })

    it('Should add both an integrity proof and a JSON-LD signature to PeerTube activities', async function () {
      const keys = readJsonSync(buildAbsoluteFixturePath('./ap-json/peertube/keys.json'))
      const ed25519Keys = generateEd25519Keys()
      const body = readJsonSync(buildAbsoluteFixturePath('./ap-json/peertube/announce-without-context.json'))

      const actorSignature = {
        url: 'http://localhost:9002/accounts/peertube',
        privateKey: keys.privateKey,
        ed25519PrivateKey: ed25519Keys.privateKey
      }

      const signedBody: any = await signAndContextify({
        byActor: actorSignature,
        data: body,
        contextType: 'Announce',
        contextFilter: fakeContextFilter(),
        signerFunction: signJsonLDObjectWithoutAssertion
      })

      expect(signedBody.proof).to.exist
      expect(signedBody.proof.verificationMethod).to.equal('http://localhost:9002/accounts/peertube#ed25519-key')
      expect(signedBody.proof['@context']).to.deep.equal(signedBody['@context'])
      expect(signedBody.signature).to.exist

      // Simulate the HTTP transport
      const received = JSON.parse(JSON.stringify(signedBody))
      expect(isIntegrityProofVerified({ data: received, publicKey: ed25519Keys.publicKey })).to.be.true

      // The JSON-LD signature covers the integrity proof
      const fromActor = { publicKey: keys.publicKey, url: 'http://localhost:9002/accounts/peertube' }
      expect(await compactJSONLDAndCheckSignature(fromActor as any, fakeExpressReq(cloneDeep(received)))).to.be.true

      const altered = cloneDeep(received)
      altered.proof.created = '2023-02-24T23:36:39Z'
      expect(await compactJSONLDAndCheckSignature(fromActor as any, fakeExpressReq(altered))).to.be.false
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
      const verified = await isHTTPSignatureVerified(parsed, actor as any)

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
      const verified = await isHTTPSignatureVerified(parsed, actor as any)

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
      const verified = await isHTTPSignatureVerified(parsed, actor as any)

      expect(verified).to.be.true
    })
  })

  describe('When checking ActivityPub content types', function () {
    it('Should accept ActivityPub content types', function () {
      const valid = [
        'application/activity+json',
        'application/activity+json; charset=utf-8',
        'Application/Activity+JSON',
        'application/ld+json; profile="https://www.w3.org/ns/activitystreams"',
        'application/ld+json;profile="https://www.w3.org/ns/activitystreams"',
        'application/ld+json; charset=utf-8; profile="https://example.com/profile https://www.w3.org/ns/activitystreams"',
        'application/ld+json; profile=https://www.w3.org/ns/activitystreams'
      ]

      for (const contentType of valid) {
        expect(isActivityPubContentType(contentType), contentType).to.be.true
      }
    })

    it('Should refuse other content types', function () {
      const invalid = [
        undefined,
        '',
        'text/vtt',
        'text/vtt; charset=utf-8',
        'application/json',
        'application/x-bittorrent',
        'application/ld+json',
        'application/ld+json; profile="https://example.com/profile"',
        'application/ld+json; charset=utf-8',
        'text/html; profile="https://www.w3.org/ns/activitystreams"',
        'application/activity+jsonp'
      ]

      for (const contentType of invalid) {
        expect(isActivityPubContentType(contentType), contentType).to.be.false
      }
    })
  })
})
