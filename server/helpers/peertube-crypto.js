'use strict'

const crypto = require('crypto')
const bcrypt = require('bcrypt')
const fs = require('fs')
const openssl = require('openssl-wrapper')

const constants = require('../initializers/constants')
const logger = require('./logger')

const peertubeCrypto = {
  checkSignature,
  comparePassword,
  createCertsIfNotExist,
  cryptPassword,
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
  const myKey = fs.readFileSync(constants.CONFIG.STORAGE.CERT_DIR + 'peertube.key.pem')
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
  certsExist(function (exist) {
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

// ---------------------------------------------------------------------------

module.exports = peertubeCrypto

// ---------------------------------------------------------------------------

function certsExist (callback) {
  fs.exists(constants.CONFIG.STORAGE.CERT_DIR + 'peertube.key.pem', function (exists) {
    return callback(exists)
  })
}

function createCerts (callback) {
  certsExist(function (exist) {
    if (exist === true) {
      const string = 'Certs already exist.'
      logger.warning(string)
      return callback(new Error(string))
    }

    logger.info('Generating a RSA key...')

    let options = {
      'out': constants.CONFIG.STORAGE.CERT_DIR + 'peertube.key.pem',
      '2048': false
    }
    openssl.exec('genrsa', options, function (err) {
      if (err) {
        logger.error('Cannot create private key on this pod.')
        return callback(err)
      }
      logger.info('RSA key generated.')

      options = {
        'in': constants.CONFIG.STORAGE.CERT_DIR + 'peertube.key.pem',
        'pubout': true,
        'out': constants.CONFIG.STORAGE.CERT_DIR + 'peertube.pub'
      }
      logger.info('Manage public key...')
      openssl.exec('rsa', options, function (err) {
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
