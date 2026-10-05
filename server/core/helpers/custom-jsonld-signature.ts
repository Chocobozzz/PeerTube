import jsonld from 'jsonld'
import { ACTIVITY_STREAMS_CONTEXT } from './jsonld-contexts/activitystreams-context.js'
import { createLogger } from './logger.js'
import { doJSONRequest } from './requests.js'
import { REQUEST_TIMEOUTS } from '../initializers/constants.js'

const logger = createLogger()

const STATIC_CACHE = {
  'https://www.w3.org/ns/activitystreams': ACTIVITY_STREAMS_CONTEXT,

  'https://w3id.org/security/v1': {
    '@context': {
      id: '@id',
      type: '@type',

      dc: 'http://purl.org/dc/terms/',
      sec: 'https://w3id.org/security#',
      xsd: 'http://www.w3.org/2001/XMLSchema#',

      EcdsaKoblitzSignature2016: 'sec:EcdsaKoblitzSignature2016',
      Ed25519Signature2018: 'sec:Ed25519Signature2018',
      EncryptedMessage: 'sec:EncryptedMessage',
      GraphSignature2012: 'sec:GraphSignature2012',
      LinkedDataSignature2015: 'sec:LinkedDataSignature2015',
      LinkedDataSignature2016: 'sec:LinkedDataSignature2016',
      CryptographicKey: 'sec:Key',

      authenticationTag: 'sec:authenticationTag',
      canonicalizationAlgorithm: 'sec:canonicalizationAlgorithm',
      cipherAlgorithm: 'sec:cipherAlgorithm',
      cipherData: 'sec:cipherData',
      cipherKey: 'sec:cipherKey',
      created: { '@id': 'dc:created', '@type': 'xsd:dateTime' },
      creator: { '@id': 'dc:creator', '@type': '@id' },
      digestAlgorithm: 'sec:digestAlgorithm',
      digestValue: 'sec:digestValue',
      domain: 'sec:domain',
      encryptionKey: 'sec:encryptionKey',
      expiration: { '@id': 'sec:expiration', '@type': 'xsd:dateTime' },
      expires: { '@id': 'sec:expiration', '@type': 'xsd:dateTime' },
      initializationVector: 'sec:initializationVector',
      iterationCount: 'sec:iterationCount',
      nonce: 'sec:nonce',
      normalizationAlgorithm: 'sec:normalizationAlgorithm',
      owner: { '@id': 'sec:owner', '@type': '@id' },
      password: 'sec:password',
      privateKey: { '@id': 'sec:privateKey', '@type': '@id' },
      privateKeyPem: 'sec:privateKeyPem',
      publicKey: { '@id': 'sec:publicKey', '@type': '@id' },
      publicKeyBase58: 'sec:publicKeyBase58',
      publicKeyPem: 'sec:publicKeyPem',
      publicKeyWif: 'sec:publicKeyWif',
      publicKeyService: { '@id': 'sec:publicKeyService', '@type': '@id' },
      revoked: { '@id': 'sec:revoked', '@type': 'xsd:dateTime' },
      salt: 'sec:salt',
      signature: 'sec:signature',
      signatureAlgorithm: 'sec:signingAlgorithm',
      signatureValue: 'sec:signatureValue'
    }
  }
}

const REMOTE_CONTEXT_CACHE_MAX_ENTRIES = 100
const remoteContextCache = new Map<string, any>()
;(jsonld as any).documentLoader = async (url: string) => {
  if (url in STATIC_CACHE) {
    return {
      contextUrl: null,
      document: STATIC_CACHE[url],
      documentUrl: url
    }
  }

  if (remoteContextCache.has(url)) return remoteContextCache.get(url)

  logger.debug('Fetching non-pinned JSON-LD context/document.', { url })

  const { body } = await doJSONRequest<any>(url, {
    timeout: REQUEST_TIMEOUTS.DEFAULT,
    bodyKBLimit: 1000,
    headers: { accept: 'application/ld+json, application/json' }
  })

  const remoteDoc = { contextUrl: null, document: body, documentUrl: url }

  if (remoteContextCache.size < REMOTE_CONTEXT_CACHE_MAX_ENTRIES) {
    remoteContextCache.set(url, remoteDoc)
  }

  return remoteDoc
}

export { jsonld }
