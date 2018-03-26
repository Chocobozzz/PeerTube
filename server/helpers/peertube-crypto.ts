import { BCRYPT_SALT_SIZE, PRIVATE_RSA_KEY_SIZE } from '../initializers'
import { ActorModel } from '../models/activitypub/actor'
import { bcryptComparePromise, bcryptGenSaltPromise, bcryptHashPromise, createPrivateKey, getPublicKey } from './core-utils'
import { jsig } from './custom-jsonld-signature'
import { logger } from './logger'

async function createPrivateAndPublicKeys () {
  logger.info('Generating a RSA key...')

  const { key } = await createPrivateKey(PRIVATE_RSA_KEY_SIZE)
  const { publicKey } = await getPublicKey(key)

  return { privateKey: key, publicKey }
}

function isSignatureVerified (fromActor: ActorModel, signedDocument: object) {
  const publicKeyObject = {
    '@context': jsig.SECURITY_CONTEXT_URL,
    '@id': fromActor.url,
    '@type':  'CryptographicKey',
    owner: fromActor.url,
    publicKeyPem: fromActor.publicKey
  }

  const publicKeyOwnerObject = {
    '@context': jsig.SECURITY_CONTEXT_URL,
    '@id': fromActor.url,
    publicKey: [ publicKeyObject ]
  }

  const options = {
    publicKey: publicKeyObject,
    publicKeyOwner: publicKeyOwnerObject
  }

  return jsig.promises.verify(signedDocument, options)
    .catch(err => {
      logger.error('Cannot check signature.', { err })
      return false
    })
}

function signObject (byActor: ActorModel, data: any) {
  const options = {
    privateKeyPem: byActor.privateKey,
    creator: byActor.url,
    algorithm: 'RsaSignature2017'
  }

  return jsig.promises.sign(data, options)
}

function comparePassword (plainPassword: string, hashPassword: string) {
  return bcryptComparePromise(plainPassword, hashPassword)
}

async function cryptPassword (password: string) {
  const salt = await bcryptGenSaltPromise(BCRYPT_SALT_SIZE)

  return bcryptHashPromise(password, salt)
}

// ---------------------------------------------------------------------------

export {
  isSignatureVerified,
  comparePassword,
  createPrivateAndPublicKeys,
  cryptPassword,
  signObject
}
