import { Request } from 'express'
import { BCRYPT_SALT_SIZE, HTTP_SIGNATURE, PRIVATE_RSA_KEY_SIZE } from '../initializers'
import { ActorModel } from '../models/activitypub/actor'
import { bcryptComparePromise, bcryptGenSaltPromise, bcryptHashPromise, createPrivateKey, getPublicKey } from './core-utils'
import { jsig } from './custom-jsonld-signature'
import { logger } from './logger'

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

function isHTTPSignatureVerified (httpSignatureParsed: any, actor: ActorModel) {
  return httpSignature.verifySignature(httpSignatureParsed, actor.publicKey) === true
}

function parseHTTPSignature (req: Request) {
  return httpSignature.parse(req, { authorizationHeaderName: HTTP_SIGNATURE.HEADER_NAME })
}

// JSONLD

function isJsonLDSignatureVerified (fromActor: ActorModel, signedDocument: any) {
  const publicKeyObject = {
    '@context': jsig.SECURITY_CONTEXT_URL,
    id: fromActor.url,
    type:  'CryptographicKey',
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

function signJsonLDObject (byActor: ActorModel, data: any) {
  const options = {
    privateKeyPem: byActor.privateKey,
    creator: byActor.url,
    algorithm: 'RsaSignature2017'
  }

  return jsig.promises.sign(data, options)
}

// ---------------------------------------------------------------------------

export {
  parseHTTPSignature,
  isHTTPSignatureVerified,
  isJsonLDSignatureVerified,
  comparePassword,
  createPrivateAndPublicKeys,
  cryptPassword,
  signJsonLDObject
}
