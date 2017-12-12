import { BCRYPT_SALT_SIZE, PRIVATE_RSA_KEY_SIZE } from '../initializers'
import { AccountModel } from '../models/account/account'
import { bcryptComparePromise, bcryptGenSaltPromise, bcryptHashPromise, createPrivateKey, getPublicKey } from './core-utils'
import { jsig } from './custom-jsonld-signature'
import { logger } from './logger'

async function createPrivateAndPublicKeys () {
  logger.info('Generating a RSA key...')

  const { key } = await createPrivateKey(PRIVATE_RSA_KEY_SIZE)
  const { publicKey } = await getPublicKey(key)

  return { privateKey: key, publicKey }
}

function isSignatureVerified (fromAccount: AccountModel, signedDocument: object) {
  const publicKeyObject = {
    '@context': jsig.SECURITY_CONTEXT_URL,
    '@id': fromAccount.url,
    '@type':  'CryptographicKey',
    owner: fromAccount.url,
    publicKeyPem: fromAccount.publicKey
  }

  const publicKeyOwnerObject = {
    '@context': jsig.SECURITY_CONTEXT_URL,
    '@id': fromAccount.url,
    publicKey: [ publicKeyObject ]
  }

  const options = {
    publicKey: publicKeyObject,
    publicKeyOwner: publicKeyOwnerObject
  }

  return jsig.promises.verify(signedDocument, options)
    .catch(err => {
      logger.error('Cannot check signature.', err)
      return false
    })
}

function signObject (byAccount: AccountModel, data: any) {
  const options = {
    privateKeyPem: byAccount.privateKey,
    creator: byAccount.url
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
