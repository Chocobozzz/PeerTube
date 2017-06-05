import * as crypto from 'crypto'
import * as bcrypt from 'bcrypt'
import * as fs from 'fs'
import * as openssl from 'openssl-wrapper'
import { join } from 'path'

import {
  SIGNATURE_ALGORITHM,
  SIGNATURE_ENCODING,
  PRIVATE_CERT_NAME,
  CONFIG,
  BCRYPT_SALT_SIZE,
  PUBLIC_CERT_NAME
} from '../initializers'
import { logger } from './logger'

function checkSignature (publicKey, data, hexSignature) {
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

function sign (data) {
  const sign = crypto.createSign(SIGNATURE_ALGORITHM)

  let dataString
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

function comparePassword (plainPassword, hashPassword, callback) {
  bcrypt.compare(plainPassword, hashPassword, function (err, isPasswordMatch) {
    if (err) return callback(err)

    return callback(null, isPasswordMatch)
  })
}

function createCertsIfNotExist (callback) {
  certsExist(function (err, exist) {
    if (err) return callback(err)

    if (exist === true) {
      return callback(null)
    }

    createCerts(function (err) {
      return callback(err)
    })
  })
}

function cryptPassword (password, callback) {
  bcrypt.genSalt(BCRYPT_SALT_SIZE, function (err, salt) {
    if (err) return callback(err)

    bcrypt.hash(password, salt, function (err, hash) {
      return callback(err, hash)
    })
  })
}

function getMyPrivateCert (callback) {
  const certPath = join(CONFIG.STORAGE.CERT_DIR, PRIVATE_CERT_NAME)
  fs.readFile(certPath, 'utf8', callback)
}

function getMyPublicCert (callback) {
  const certPath = join(CONFIG.STORAGE.CERT_DIR, PUBLIC_CERT_NAME)
  fs.readFile(certPath, 'utf8', callback)
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

function certsExist (callback) {
  const certPath = join(CONFIG.STORAGE.CERT_DIR, PRIVATE_CERT_NAME)
  fs.access(certPath, function (err) {
    // If there is an error the certificates do not exist
    const exists = !err
    return callback(null, exists)
  })
}

function createCerts (callback) {
  certsExist(function (err, exist) {
    if (err) return callback(err)

    if (exist === true) {
      const string = 'Certs already exist.'
      logger.warning(string)
      return callback(new Error(string))
    }

    logger.info('Generating a RSA key...')

    const privateCertPath = join(CONFIG.STORAGE.CERT_DIR, PRIVATE_CERT_NAME)
    const genRsaOptions = {
      'out': privateCertPath,
      '2048': false
    }
    openssl.exec('genrsa', genRsaOptions, function (err) {
      if (err) {
        logger.error('Cannot create private key on this pod.')
        return callback(err)
      }

      logger.info('RSA key generated.')
      logger.info('Managing public key...')

      const publicCertPath = join(CONFIG.STORAGE.CERT_DIR, 'peertube.pub')
      const rsaOptions = {
        'in': privateCertPath,
        'pubout': true,
        'out': publicCertPath
      }
      openssl.exec('rsa', rsaOptions, function (err) {
        if (err) {
          logger.error('Cannot create public key on this pod.')
          return callback(err)
        }

        logger.info('Public key managed.')
        return callback(null)
      })
    })
  })
}
