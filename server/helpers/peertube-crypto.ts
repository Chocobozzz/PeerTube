import * as crypto from 'crypto'
import * as fs from 'fs'
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
      logger.error('Cannot check signature.', { error: err })
      return false
    }
  }

  verify.update(dataString, 'utf8')

  const isValid = verify.verify(publicKey, hexSignature, SIGNATURE_ENCODING)
  return isValid
}

function sign (data: string|Object) {
  const sign = crypto.createSign(SIGNATURE_ALGORITHM)

  let dataString: string
  if (typeof data === 'string') {
    dataString = data
  } else {
    try {
      dataString = JSON.stringify(data)
    } catch (err) {
      logger.error('Cannot sign data.', { error: err })
      return ''
    }
  }

  sign.update(dataString, 'utf8')

  // TODO: make async
  const certPath = join(CONFIG.STORAGE.CERT_DIR, PRIVATE_CERT_NAME)
  const myKey = fs.readFileSync(certPath)
  const signature = sign.sign(myKey.toString(), SIGNATURE_ENCODING)

  return signature
}

function comparePassword (plainPassword: string, hashPassword: string) {
  return bcryptComparePromise(plainPassword, hashPassword)
}

function createCertsIfNotExist () {
  return certsExist().then(exist => {
    if (exist === true) {
      return undefined
    }

    return createCerts()
  })
}

function cryptPassword (password: string) {
  return bcryptGenSaltPromise(BCRYPT_SALT_SIZE).then(salt => bcryptHashPromise(password, salt))
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

function certsExist () {
  const certPath = join(CONFIG.STORAGE.CERT_DIR, PRIVATE_CERT_NAME)

  // If there is an error the certificates do not exist
  return accessPromise(certPath)
    .then(() => true)
    .catch(() => false)
}

function createCerts () {
  return certsExist().then(exist => {
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
    return opensslExecPromise('genrsa', genRsaOptions)
      .then(() => {
        logger.info('RSA key generated.')
        logger.info('Managing public key...')

        const publicCertPath = join(CONFIG.STORAGE.CERT_DIR, 'peertube.pub')
        const rsaOptions = {
          'in': privateCertPath,
          'pubout': true,
          'out': publicCertPath
        }
        return opensslExecPromise('rsa', rsaOptions)
          .then(() => logger.info('Public key managed.'))
          .catch(err => {
            logger.error('Cannot create public key on this pod.')
            throw err
          })
      })
      .catch(err => {
        logger.error('Cannot create private key on this pod.')
        throw err
      })
  })
}
