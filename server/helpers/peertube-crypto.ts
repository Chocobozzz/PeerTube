import { Request } from 'express'
import { BCRYPT_SALT_SIZE, HTTP_SIGNATURE, PRIVATE_RSA_KEY_SIZE } from '../initializers/constants'
import { createPrivateKey, getPublicKey, promisify1, promisify2, sha256 } from './core-utils'
import { jsonld } from './custom-jsonld-signature'
import { logger } from './logger'
import { cloneDeep } from 'lodash'
import { createSign, createVerify } from 'crypto'
import * as bcrypt from 'bcrypt'
import { MActor } from '../types/models'

const bcryptComparePromise = promisify2<any, string, boolean>(bcrypt.compare)
const bcryptGenSaltPromise = promisify1<number, string>(bcrypt.genSalt)
const bcryptHashPromise = promisify2<any, string | number, string>(bcrypt.hash)

const httpSignature = require('http-signature')

async function createPrivateAndPublicKeys () {
  logger.info('Generating a RSA key...')

  const { key } = await createPrivateKey(PRIVATE_RSA_KEY_SIZE)
  const { publicKey } = await getPublicKey(key)

  return { privateKey: key, publicKey }
}

// User password checks

function comparePassword (plainPassword: string, hashPassword: string) {
  return bcryptComparePromise(plainPassword, hashPassword)
}

async function cryptPassword (password: string) {
  const salt = await bcryptGenSaltPromise(BCRYPT_SALT_SIZE)

  return bcryptHashPromise(password, salt)
}

// HTTP Signature

function isHTTPSignatureDigestValid (rawBody: Buffer, req: Request): boolean {
  if (req.headers[HTTP_SIGNATURE.HEADER_NAME] && req.headers['digest']) {
    return buildDigest(rawBody.toString()) === req.headers['digest']
  }

  return true
}

function isHTTPSignatureVerified (httpSignatureParsed: any, actor: MActor): boolean {
  return httpSignature.verifySignature(httpSignatureParsed, actor.publicKey) === true
}

function parseHTTPSignature (req: Request, clockSkew?: number) {
  return httpSignature.parse(req, { clockSkew })
}

// JSONLD

function isJsonLDSignatureVerified (fromActor: MActor, signedDocument: any): Promise<boolean> {
  if (signedDocument.signature.type === 'RsaSignature2017') {
    return isJsonLDRSA2017Verified(fromActor, signedDocument)
  }

  logger.warn('Unknown JSON LD signature %s.', signedDocument.signature.type, signedDocument)

  return Promise.resolve(false)
}

// Backward compatibility with "other" implementations
async function isJsonLDRSA2017Verified (fromActor: MActor, signedDocument: any) {
  const [ documentHash, optionsHash ] = await Promise.all([
    createDocWithoutSignatureHash(signedDocument),
    createSignatureHash(signedDocument.signature)
  ])

  const toVerify = optionsHash + documentHash

  const verify = createVerify('RSA-SHA256')
  verify.update(toVerify, 'utf8')

  return verify.verify(fromActor.publicKey, signedDocument.signature.signatureValue, 'base64')
}

async function signJsonLDObject (byActor: MActor, data: any) {
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

function buildDigest (body: any) {
  const rawBody = typeof body === 'string' ? body : JSON.stringify(body)

  return 'SHA-256=' + sha256(rawBody, 'base64')
}

// ---------------------------------------------------------------------------

export {
  isHTTPSignatureDigestValid,
  parseHTTPSignature,
  isHTTPSignatureVerified,
  buildDigest,
  isJsonLDSignatureVerified,
  comparePassword,
  createPrivateAndPublicKeys,
  cryptPassword,
  signJsonLDObject
}

// ---------------------------------------------------------------------------

function hash (obj: any): Promise<any> {
  return jsonld.promises
               .normalize(obj, {
                 algorithm: 'URDNA2015',
                 format: 'application/n-quads'
               })
               .then(res => sha256(res))
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

  return hash(signatureCopy)
}

function createDocWithoutSignatureHash (doc: any) {
  const docWithoutSignature = cloneDeep(doc)
  delete docWithoutSignature.signature

  return hash(docWithoutSignature)
}
