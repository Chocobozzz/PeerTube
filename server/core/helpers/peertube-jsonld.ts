import { omit } from '@peertube/peertube-core-utils'
import { sha256 } from '@peertube/peertube-node-utils'
import { createSign, createVerify } from 'crypto'
import cloneDeep from 'lodash-es/cloneDeep.js'
import { MActor } from '../types/models/index.js'
import { getAllContext } from './activity-pub-utils.js'
import { jsonld } from './custom-jsonld-signature.js'
import { isArray } from './custom-validators/misc.js'
import { logger } from './logger.js'
import { assertIsInWorkerThread } from './threads.js'

type ExpressRequest = { body: any }

export function compactJSONLDAndCheckSignature (fromActor: MActor, req: ExpressRequest): Promise<boolean> {
  if (req.body.signature.type === 'RsaSignature2017') {
    return compactJSONLDAndCheckRSA2017Signature(fromActor, req)
  }

  logger.warn('Unknown JSON LD signature %s.', req.body.signature.type, req.body)

  return Promise.resolve(false)
}

// Backward compatibility with "other" implementations
export async function compactJSONLDAndCheckRSA2017Signature (fromActor: MActor, req: ExpressRequest) {
  const compacted = await jsonldCompact(omit(req.body, [ 'signature' ]))

  fixCompacted(req.body, compacted)

  req.body = { ...compacted, signature: req.body.signature }

  if (compacted['@include']) {
    logger.warn('JSON-LD @include is not supported')
    return false
  }

  // TODO: compat with < 6.1, remove in 7.0
  let safe = true
  if (
    (compacted.type === 'Create' && (compacted?.object?.type === 'WatchAction' || compacted?.object?.type === 'CacheFile')) ||
    (compacted.type === 'Undo' && compacted?.object?.type === 'Create' && compacted?.object?.object.type === 'CacheFile')
  ) {
    safe = false
  }

  const [ documentHash, optionsHash ] = await Promise.all([
    hashObject(compacted, safe),
    createSignatureHash(req.body.signature, safe)
  ])

  const toVerify = optionsHash + documentHash

  const verify = createVerify('RSA-SHA256')
  verify.update(toVerify, 'utf8')

  return verify.verify(fromActor.publicKey, req.body.signature.signatureValue, 'base64')
}

function fixCompacted (original: any, compacted: any) {
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
      fixCompacted(original[k], compacted[k])
    }
  }
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

async function hashObject (obj: any, safe: boolean): Promise<any> {
  const res = await jsonldNormalize(obj, safe)

  return sha256(res)
}

function jsonldCompact (obj: any) {
  return (jsonld as any).promises.compact(obj, getAllContext())
}

function jsonldNormalize (obj: any, safe: boolean) {
  return (jsonld as any).promises.normalize(obj, {
    safe,
    algorithm: 'URDNA2015',
    format: 'application/n-quads'
  })
}

// ---------------------------------------------------------------------------

function createSignatureHash (signature: any, safe = true) {
  return hashObject({
    '@context': [
      'https://w3id.org/security/v1',
      { RsaSignature2017: 'https://w3id.org/security#RsaSignature2017' }
    ],

    ...omit(signature, [ 'type', 'id', 'signatureValue' ])
  }, safe)
}

function createDocWithoutSignatureHash (doc: any) {
  const docWithoutSignature = cloneDeep(doc)
  delete docWithoutSignature.signature

  return hashObject(docWithoutSignature, true)
}
