'use strict'

const bcrypt = require('bcrypt')
const crypto = require('crypto')
const fs = require('fs')
const openssl = require('openssl-wrapper')
const ursa = require('ursa')

const constants = require('../initializers/constants')
const logger = require('./logger')

const algorithm = 'aes-256-ctr'

const peertubeCrypto = {
  checkSignature: checkSignature,
  comparePassword: comparePassword,
  createCertsIfNotExist: createCertsIfNotExist,
  cryptPassword: cryptPassword,
  decrypt: decrypt,
  encrypt: encrypt,
  sign: sign
}

function checkSignature (publicKey, rawData, hexSignature) {
  const crt = ursa.createPublicKey(publicKey)
  const isValid = crt.hashAndVerify('sha256', new Buffer(rawData).toString('hex'), hexSignature, 'hex')
  return isValid
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

function decrypt (key, data, callback) {
  fs.readFile(constants.CONFIG.STORAGE.CERT_DIR + 'peertube.key.pem', function (err, file) {
    if (err) return callback(err)

    const myPrivateKey = ursa.createPrivateKey(file)
    const decryptedKey = myPrivateKey.decrypt(key, 'hex', 'utf8')
    const decryptedData = symetricDecrypt(data, decryptedKey)

    return callback(null, decryptedData)
  })
}

function encrypt (publicKey, data, callback) {
  const crt = ursa.createPublicKey(publicKey)

  symetricEncrypt(data, function (err, dataEncrypted) {
    if (err) return callback(err)

    const key = crt.encrypt(dataEncrypted.password, 'utf8', 'hex')
    const encrypted = {
      data: dataEncrypted.crypted,
      key: key
    }

    callback(null, encrypted)
  })
}

function sign (data) {
  const myKey = ursa.createPrivateKey(fs.readFileSync(constants.CONFIG.STORAGE.CERT_DIR + 'peertube.key.pem'))
  const signature = myKey.hashAndSign('sha256', data, 'utf8', 'hex')

  return signature
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

function generatePassword (callback) {
  crypto.randomBytes(32, function (err, buf) {
    if (err) return callback(err)

    callback(null, buf.toString('utf8'))
  })
}

function symetricDecrypt (text, password) {
  const decipher = crypto.createDecipher(algorithm, password)
  let dec = decipher.update(text, 'hex', 'utf8')
  dec += decipher.final('utf8')
  return dec
}

function symetricEncrypt (text, callback) {
  generatePassword(function (err, password) {
    if (err) return callback(err)

    const cipher = crypto.createCipher(algorithm, password)
    let crypted = cipher.update(text, 'utf8', 'hex')
    crypted += cipher.final('hex')
    callback(null, { crypted: crypted, password: password })
  })
}
