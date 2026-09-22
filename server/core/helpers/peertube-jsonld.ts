import { omit } from '@peertube/peertube-core-utils'
import { sha256 } from '@peertube/peertube-node-utils'
import { createSign, createVerify } from 'crypto'
import cloneDeep from 'lodash-es/cloneDeep.js'
import { ACTIVITY_PUB } from '@server/initializers/constants.js'
import { MActor } from '../types/models/index.js'
import { getAllContext } from './activity-pub-utils.js'
import { jsonld } from './custom-jsonld-signature.js'
import { isArray } from './custom-validators/misc.js'
import { createLogger } from './logger.js'
import { assertIsInWorkerThread } from './threads.js'

const logger = createLogger()

type ExpressRequest = { body: any }

export async function compactJSONLDAndCheckSignature (fromActor: MActor, req: ExpressRequest): Promise<boolean> {
  if (req.body.signature.type === 'RsaSignature2017') {
    // URDNA2015 canonicalization of the whole body is ~O(n²) in the number of blank nodes
    // It runs before the signature is verified, so bound the input size before canonicalizing
    const bodySize = Buffer.byteLength(JSON.stringify(req.body))
    if (bodySize > ACTIVITY_PUB.CHECK_JSON_LD_SIGNATURE.MAX_BODY_SIZE) {
      logger.warn(
        'Refusing to check JSON-LD signature of a %d bytes body sent by %s (max: %d).',
        bodySize,
        fromActor.url,
        ACTIVITY_PUB.CHECK_JSON_LD_SIGNATURE.MAX_BODY_SIZE
      )

      return false
    }

    return compactJSONLDAndCheckRSA2017Signature(fromActor, req)
  }

  logger.warn('Unknown JSON LD signature %s.', req.body.signature.type, req.body)

  return false
}

// Backward compatibility with "other" implementations
export async function compactJSONLDAndCheckRSA2017Signature (fromActor: MActor, req: ExpressRequest) {
  const { verified, body } = await checkRSA2017Signature(fromActor.publicKey, req.body)

  req.body = body

  return verified
}

// Core signature verification logic (canonicalization + RSA check)
async function checkRSA2017Signature (publicKey: string, originalBody: any): Promise<{
  verified: boolean
  body: any
}> {
  const compacted = await jsonldCompact(omit(originalBody, [ 'signature' ]))

  fixCompacted(originalBody, compacted)

  const body = { ...compacted, signature: originalBody.signature }

  if (containInvalidJsonldKeys(compacted)) {
    logger.warn('JSON-LD @included, @graph or @reverse are not supported')
    return { verified: false, body }
  }

  const [ documentHash, optionsHash ] = await Promise.all([
    hashObject(compacted),
    createSignatureHash(body.signature)
  ])

  const toVerify = optionsHash + documentHash

  const verify = createVerify('RSA-SHA256')
  verify.update(toVerify, 'utf8')

  const verified = verify.verify(publicKey, body.signature.signatureValue, 'base64')

  return { verified, body }
}

function fixCompacted (original: any, compacted: any, depth = 1) {
  if (depth > 20) return
  if (!original || !compacted) return

  for (const [ k, v ] of Object.entries(original)) {
    if (k === '@context' || k === 'signature') continue
    if (v === undefined || v === null) continue

    const cv = compacted[k]
    if (cv === undefined || cv === null) continue

    if (typeof v === 'string') {
      if (v === 'https://www.w3.org/ns/activitystreams#Public' && cv === 'as:Public') {
        compacted[k] = v
      }
    }

    if (isArray(v) && !isArray(cv)) {
      compacted[k] = [ cv ]

      for (let i = 0; i < v.length; i++) {
        if (v[i] === 'https://www.w3.org/ns/activitystreams#Public' && cv[i] === 'as:Public') {
          compacted[k][i] = v[i]
        }
      }
    }

    if (typeof v === 'object') {
      fixCompacted(original[k], compacted[k], depth += 1)
    }
  }
}

export async function signJsonLDObject<T> (options: {
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
  const res = await jsonldNormalize(obj)

  return sha256(res)
}

function jsonldCompact (obj: any) {
  return (jsonld as any).promises.compact(obj, getAllContext())
}

function jsonldNormalize (obj: any) {
  return (jsonld as any).promises.normalize(obj, {
    safe: true,
    format: 'application/n-quads',
    canonizeOptions: {
      algorithm: 'URDNA2015',
      // Explicitly bound the work rdf-canonize does on indistinguishable blank nodes
      maxWorkFactor: 1,
      // Also bound canonicalization by wall-clock time, in case maxWorkFactor is not enough
      signal: AbortSignal.timeout(ACTIVITY_PUB.CHECK_JSON_LD_SIGNATURE.CANONIZE_TIMEOUT)
    }
  })
}

// ---------------------------------------------------------------------------

function createSignatureHash (signature: any) {
  return hashObject({
    '@context': [
      'https://w3id.org/security/v1',
      { RsaSignature2017: 'https://w3id.org/security#RsaSignature2017' }
    ],

    ...omit(signature, [ 'type', 'id', 'signatureValue' ])
  })
}

function createDocWithoutSignatureHash (doc: any) {
  const docWithoutSignature = cloneDeep(doc)
  delete docWithoutSignature.signature

  return hashObject(docWithoutSignature)
}

function containInvalidJsonldKeys (obj: any, depth = 1) {
  if (depth > 20) return true

  if (typeof obj !== 'object' || obj === null) return false

  if (Array.isArray(obj)) {
    return obj.some(item => containInvalidJsonldKeys(item, depth + 1))
  }

  if ('@included' in obj || '@graph' in obj || '@reverse' in obj) return true

  return Object.values(obj).some(value => containInvalidJsonldKeys(value, depth + 1))
}
