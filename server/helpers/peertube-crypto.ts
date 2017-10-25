import * as crypto from 'crypto'
import { join } from 'path'

import {
  SIGNATURE_ALGORITHM,
  SIGNATURE_ENCODING,
  PRIVATE_CERT_NAME,
  CONFIG,
  BCRYPT_SALT_SIZE,
  PUBLIC_CERT_NAME
} from '../initializers'
import {
  readFilePromise,
  bcryptComparePromise,
  bcryptGenSaltPromise,
  bcryptHashPromise,
  accessPromise,
  opensslExecPromise
} from './core-utils'
import { logger } from './logger'

function checkSignature (publicKey: string, data: string, hexSignature: string) {
  const verify = crypto.createVerify(SIGNATURE_ALGORITHM)

  let dataString
  if (typeof data === 'string') {
    dataString = data
  } else {
    try {
      dataString = JSON.stringify(data)
    } catch (err) {
      logger.error('Cannot check signature.', err)
      return false
    }
  }

  verify.update(dataString, 'utf8')

  const isValid = verify.verify(publicKey, hexSignature, SIGNATURE_ENCODING)
  return isValid
}

async function sign (data: string|Object) {
  const sign = crypto.createSign(SIGNATURE_ALGORITHM)

  let dataString: string
  if (typeof data === 'string') {
    dataString = data
  } else {
    try {
      dataString = JSON.stringify(data)
    } catch (err) {
      logger.error('Cannot sign data.', err)
      return ''
    }
  }

  sign.update(dataString, 'utf8')

  const myKey = await getMyPrivateCert()
  return sign.sign(myKey, SIGNATURE_ENCODING)
}

function comparePassword (plainPassword: string, hashPassword: string) {
  return bcryptComparePromise(plainPassword, hashPassword)
}

async function createCertsIfNotExist () {
  const exist = await certsExist()
  if (exist === true) {
    return
  }

  return await createCerts()
}

async function cryptPassword (password: string) {
  const salt = await bcryptGenSaltPromise(BCRYPT_SALT_SIZE)

  return await bcryptHashPromise(password, salt)
}

function getMyPrivateCert () {
  const certPath = join(CONFIG.STORAGE.CERT_DIR, PRIVATE_CERT_NAME)
  return readFilePromise(certPath, 'utf8')
}

function getMyPublicCert () {
  const certPath = join(CONFIG.STORAGE.CERT_DIR, PUBLIC_CERT_NAME)
  return readFilePromise(certPath, 'utf8')
}

// ---------------------------------------------------------------------------

export {
  checkSignature,
  comparePassword,
  createCertsIfNotExist,
  cryptPassword,
  getMyPrivateCert,
  getMyPublicCert,
  sign
}

// ---------------------------------------------------------------------------

async function certsExist () {
  const certPath = join(CONFIG.STORAGE.CERT_DIR, PRIVATE_CERT_NAME)

  // If there is an error the certificates do not exist
  try {
    await accessPromise(certPath)

    return true
  } catch {
    return false
  }
}

async function createCerts () {
  const exist = await certsExist()
  if (exist === true) {
    const errorMessage = 'Certs already exist.'
    logger.warning(errorMessage)
    throw new Error(errorMessage)
  }

  logger.info('Generating a RSA key...')

  const privateCertPath = join(CONFIG.STORAGE.CERT_DIR, PRIVATE_CERT_NAME)
  const genRsaOptions = {
    'out': privateCertPath,
    '2048': false
  }

  await opensslExecPromise('genrsa', genRsaOptions)
  logger.info('RSA key generated.')
  logger.info('Managing public key...')

  const publicCertPath = join(CONFIG.STORAGE.CERT_DIR, 'peertube.pub')
  const rsaOptions = {
    'in': privateCertPath,
    'pubout': true,
    'out': publicCertPath
  }

  await opensslExecPromise('rsa', rsaOptions)
}
