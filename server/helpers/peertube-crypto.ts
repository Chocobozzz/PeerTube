import { Request } from 'express'
import { BCRYPT_SALT_SIZE, HTTP_SIGNATURE, PRIVATE_RSA_KEY_SIZE } from '../initializers/constants'
import { ActorModel } from '../models/activitypub/actor'
import { createPrivateKey, getPublicKey, promisify1, promisify2, sha256 } from './core-utils'
import { jsig, jsonld } from './custom-jsonld-signature'
import { logger } from './logger'
import { cloneDeep } from 'lodash'
import { createVerify } from 'crypto'
import { buildDigest } from '../lib/job-queue/handlers/utils/activitypub-http-utils'
import * as bcrypt from 'bcrypt'
import { MActor } from '../typings/models'

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
  return httpSignature.parse(req, { authorizationHeaderName: HTTP_SIGNATURE.HEADER_NAME, clockSkew })
}

// JSONLD

async function isJsonLDSignatureVerified (fromActor: MActor, signedDocument: any): Promise<boolean> {
  if (signedDocument.signature.type === 'RsaSignature2017') {
    // Mastodon algorithm
    const res = await isJsonLDRSA2017Verified(fromActor, signedDocument)
    // Success? If no, try with our library
    if (res === true) return true
  }

  const publicKeyObject = {
    '@context': jsig.SECURITY_CONTEXT_URL,
    id: fromActor.url,
    type: 'CryptographicKey',
    owner: fromActor.url,
    publicKeyPem: fromActor.publicKey
  }

  const publicKeyOwnerObject = {
    '@context': jsig.SECURITY_CONTEXT_URL,
    id: fromActor.url,
    publicKey: [ publicKeyObject ]
  }

  const options = {
    publicKey: publicKeyObject,
    publicKeyOwner: publicKeyOwnerObject
  }

  return jsig.promises
             .verify(signedDocument, options)
             .then((result: { verified: boolean }) => result.verified)
             .catch(err => {
               logger.error('Cannot check signature.', { err })
               return false
             })
}

// Backward compatibility with "other" implementations
async function isJsonLDRSA2017Verified (fromActor: MActor, signedDocument: any) {
  function hash (obj: any): Promise<any> {
    return jsonld.promises
                 .normalize(obj, {
                   algorithm: 'URDNA2015',
                   format: 'application/n-quads'
                 })
                 .then(res => sha256(res))
  }

  const signatureCopy = cloneDeep(signedDocument.signature)
  Object.assign(signatureCopy, {
    '@context': [
      'https://w3id.org/security/v1',
      { RsaSignature2017: 'https://w3id.org/security#RsaSignature2017' }
    ]
  })
  delete signatureCopy.type
  delete signatureCopy.id
  delete signatureCopy.signatureValue

  const docWithoutSignature = cloneDeep(signedDocument)
  delete docWithoutSignature.signature

  const [ documentHash, optionsHash ] = await Promise.all([
    hash(docWithoutSignature),
    hash(signatureCopy)
  ])

  const toVerify = optionsHash + documentHash

  const verify = createVerify('RSA-SHA256')
  verify.update(toVerify, 'utf8')

  return verify.verify(fromActor.publicKey, signedDocument.signature.signatureValue, 'base64')
}

function signJsonLDObject (byActor: MActor, data: any) {
  const options = {
    privateKeyPem: byActor.privateKey,
    creator: byActor.url,
    algorithm: 'RsaSignature2017'
  }

  return jsig.promises.sign(data, options)
}

// ---------------------------------------------------------------------------

export {
  isHTTPSignatureDigestValid,
  parseHTTPSignature,
  isHTTPSignatureVerified,
  isJsonLDSignatureVerified,
  comparePassword,
  createPrivateAndPublicKeys,
  cryptPassword,
  signJsonLDObject
}

// ---------------------------------------------------------------------------
