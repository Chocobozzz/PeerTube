import * as AsyncLRU from 'async-lru'
import * as jsonld from 'jsonld'
import { logger } from './logger'

const CACHE = {
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

const nodeDocumentLoader = jsonld.documentLoaders.node()

const lru = new AsyncLRU({
  max: 10,
  load: (url, cb) => {
    if (CACHE[url] !== undefined) {
      logger.debug('Using cache for JSON-LD %s.', url)

      return cb(null, {
        contextUrl: null,
        document: CACHE[url],
        documentUrl: url
      })
    }

    nodeDocumentLoader(url)
      .then(value => cb(null, value))
      .catch(err => cb(err))
  }
})

jsonld.documentLoader = (url) => {
  return new Promise((res, rej) => {
    lru.get(url, (err, value) => {
      if (err) return rej(err)

      return res(value)
    })
  })
}

export { jsonld }
