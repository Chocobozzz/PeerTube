import { sha256 } from '@peertube/peertube-node-utils'
import { createSign, createVerify } from 'crypto'
import cloneDeep from 'lodash-es/cloneDeep.js'
import { MActor } from '../types/models/index.js'
import { logger } from './logger.js'
import { assertIsInWorkerThread } from './threads.js'
import { jsonld } from './custom-jsonld-signature.js'

export function isJsonLDSignatureVerified (fromActor: MActor, signedDocument: any): Promise<boolean> {
  if (signedDocument.signature.type === 'RsaSignature2017') {
    return isJsonLDRSA2017Verified(fromActor, signedDocument)
  }

  logger.warn('Unknown JSON LD signature %s.', signedDocument.signature.type, signedDocument)

  return Promise.resolve(false)
}

// Backward compatibility with "other" implementations
export async function isJsonLDRSA2017Verified (fromActor: MActor, signedDocument: any) {
  const [ documentHash, optionsHash ] = await Promise.all([
    createDocWithoutSignatureHash(signedDocument),
    createSignatureHash(signedDocument.signature)
  ])

  const toVerify = optionsHash + documentHash

  const verify = createVerify('RSA-SHA256')
  verify.update(toVerify, 'utf8')

  return verify.verify(fromActor.publicKey, signedDocument.signature.signatureValue, 'base64')
}

export async function signJsonLDObject <T> (options: {
  byActor: { url: string, privateKey: string }
  data: T
  disableWorkerThreadAssertion?: boolean
}) {
  const { byActor, data, disableWorkerThreadAssertion = false } = options

  if (!disableWorkerThreadAssertion) assertIsInWorkerThread()

  const signature = {
    type: 'RsaSignature2017',
    creator: byActor.url,
    created: new Date().toISOString()
  }

  const [ documentHash, optionsHash ] = await Promise.all([
    createDocWithoutSignatureHash(data),
    createSignatureHash(signature)
  ])

  const toSign = optionsHash + documentHash

  const sign = createSign('RSA-SHA256')
  sign.update(toSign, 'utf8')

  const signatureValue = sign.sign(byActor.privateKey, 'base64')
  Object.assign(signature, { signatureValue })

  return Object.assign(data, { signature })
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

async function hashObject (obj: any): Promise<any> {
  const res = await (jsonld as any).promises.normalize(obj, {
    safe: false,
    algorithm: 'URDNA2015',
    format: 'application/n-quads'
  })

  return sha256(res)
}

function createSignatureHash (signature: any) {
  const signatureCopy = cloneDeep(signature)
  Object.assign(signatureCopy, {
    '@context': [
      'https://w3id.org/security/v1',
      { RsaSignature2017: 'https://w3id.org/security#RsaSignature2017' }
    ]
  })

  delete signatureCopy.type
  delete signatureCopy.id
  delete signatureCopy.signatureValue

  return hashObject(signatureCopy)
}

function createDocWithoutSignatureHash (doc: any) {
  const docWithoutSignature = cloneDeep(doc)
  delete docWithoutSignature.signature

  return hashObject(docWithoutSignature)
}
