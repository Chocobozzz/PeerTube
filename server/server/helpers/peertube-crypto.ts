import httpSignature from '@peertube/http-signature'
import { sha256 } from '@peertube/peertube-node-utils'
import { createCipheriv, createDecipheriv, createSign, createVerify } from 'crypto'
import { Request } from 'express'
import cloneDeep from 'lodash-es/cloneDeep.js'
import { BCRYPT_SALT_SIZE, ENCRYPTION, HTTP_SIGNATURE, PRIVATE_RSA_KEY_SIZE } from '../initializers/constants.js'
import { MActor } from '../types/models/index.js'
import { generateRSAKeyPairPromise, randomBytesPromise, scryptPromise } from './core-utils.js'
import { logger } from './logger.js'

function createPrivateAndPublicKeys () {
  logger.info('Generating a RSA key...')

  return generateRSAKeyPairPromise(PRIVATE_RSA_KEY_SIZE)
}

// ---------------------------------------------------------------------------
// User password checks
// ---------------------------------------------------------------------------

async function comparePassword (plainPassword: string, hashPassword: string) {
  if (!plainPassword) return false

  const { compare } = await import('bcrypt')

  return compare(plainPassword, hashPassword)
}

async function cryptPassword (password: string) {
  const { genSalt, hash } = await import('bcrypt')

  const salt = await genSalt(BCRYPT_SALT_SIZE)

  return hash(password, salt)
}

// ---------------------------------------------------------------------------
// HTTP Signature
// ---------------------------------------------------------------------------

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
  const requiredHeaders = req.method === 'POST'
    ? [ '(request-target)', 'host', 'digest' ]
    : [ '(request-target)', 'host' ]

  const parsed = httpSignature.parse(req, { clockSkew, headers: requiredHeaders })

  const parsedHeaders = parsed.params.headers
  if (!parsedHeaders.includes('date') && !parsedHeaders.includes('(created)')) {
    throw new Error(`date or (created) must be included in signature`)
  }

  return parsed
}

// ---------------------------------------------------------------------------
// JSONLD
// ---------------------------------------------------------------------------

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

async function signJsonLDObject <T> (byActor: { url: string, privateKey: string }, data: T) {
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

function buildDigest (body: any) {
  const rawBody = typeof body === 'string' ? body : JSON.stringify(body)

  return 'SHA-256=' + sha256(rawBody, 'base64')
}

// ---------------------------------------------------------------------------
// Encryption
// ---------------------------------------------------------------------------

async function encrypt (str: string, secret: string) {
  const iv = await randomBytesPromise(ENCRYPTION.IV)

  const key = await scryptPromise(secret, ENCRYPTION.SALT, 32)
  const cipher = createCipheriv(ENCRYPTION.ALGORITHM, key, iv)

  let encrypted = iv.toString(ENCRYPTION.ENCODING) + ':'
  encrypted += cipher.update(str, 'utf8', ENCRYPTION.ENCODING)
  encrypted += cipher.final(ENCRYPTION.ENCODING)

  return encrypted
}

async function decrypt (encryptedArg: string, secret: string) {
  const [ ivStr, encryptedStr ] = encryptedArg.split(':')

  const iv = Buffer.from(ivStr, 'hex')
  const key = await scryptPromise(secret, ENCRYPTION.SALT, 32)

  const decipher = createDecipheriv(ENCRYPTION.ALGORITHM, key, iv)

  return decipher.update(encryptedStr, ENCRYPTION.ENCODING, 'utf8') + decipher.final('utf8')
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
  signJsonLDObject,

  encrypt,
  decrypt
}

// ---------------------------------------------------------------------------

async function hashObject (obj: any): Promise<any> {
  const { jsonld } = await import('./custom-jsonld-signature.js')

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
