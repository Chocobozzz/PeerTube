'use strict'

const crypto = require('crypto')
const bcrypt = require('bcrypt')
const fs = require('fs')
const openssl = require('openssl-wrapper')
const pathUtils = require('path')

const constants = require('../initializers/constants')
const logger = require('./logger')

const peertubeCrypto = {
  checkSignature,
  comparePassword,
  createCertsIfNotExist,
  cryptPassword,
  getMyPrivateCert,
  getMyPublicCert,
  sign
}

function checkSignature (publicKey, data, hexSignature) {
  const verify = crypto.createVerify(constants.SIGNATURE_ALGORITHM)

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

  const isValid = verify.verify(publicKey, hexSignature, constants.SIGNATURE_ENCODING)
  return isValid
}

function sign (data) {
  const sign = crypto.createSign(constants.SIGNATURE_ALGORITHM)

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
  const certPath = pathUtils.join(constants.CONFIG.STORAGE.CERT_DIR, constants.PRIVATE_CERT_NAME)
  const myKey = fs.readFileSync(certPath)
  const signature = sign.sign(myKey, constants.SIGNATURE_ENCODING)

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
  bcrypt.genSalt(constants.BCRYPT_SALT_SIZE, function (err, salt) {
    if (err) return callback(err)

    bcrypt.hash(password, salt, function (err, hash) {
      return callback(err, hash)
    })
  })
}

function getMyPrivateCert (callback) {
  const certPath = pathUtils.join(constants.CONFIG.STORAGE.CERT_DIR, constants.PRIVATE_CERT_NAME)
  fs.readFile(certPath, 'utf8', callback)
}

function getMyPublicCert (callback) {
  const certPath = pathUtils.join(constants.CONFIG.STORAGE.CERT_DIR, constants.PUBLIC_CERT_NAME)
  fs.readFile(certPath, 'utf8', callback)
}

// ---------------------------------------------------------------------------

module.exports = peertubeCrypto

// ---------------------------------------------------------------------------

function certsExist (callback) {
  const certPath = pathUtils.join(constants.CONFIG.STORAGE.CERT_DIR, constants.PRIVATE_CERT_NAME)
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

    const privateCertPath = pathUtils.join(constants.CONFIG.STORAGE.CERT_DIR, constants.PRIVATE_CERT_NAME)
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

      const publicCertPath = pathUtils.join(constants.CONFIG.STORAGE.CERT_DIR, 'peertube.pub')
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
