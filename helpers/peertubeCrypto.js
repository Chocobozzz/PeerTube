;(function () {
  'use strict'

  var config = require('config')
  var crypto = require('crypto')
  var fs = require('fs')
  var openssl = require('openssl-wrapper')
  var ursa = require('ursa')

  var logger = require('./logger')

  var certDir = __dirname + '/../' + config.get('storage.certs')
  var algorithm = 'aes-256-ctr'

  var peertubeCrypto = {
    checkSignature: checkSignature,
    createCertsIfNotExist: createCertsIfNotExist,
    decrypt: decrypt,
    encrypt: encrypt,
    getCertDir: getCertDir,
    sign: sign
  }

  function checkSignature (public_key, raw_data, hex_signature) {
    var crt = ursa.createPublicKey(public_key)
    var is_valid = crt.hashAndVerify('sha256', new Buffer(raw_data).toString('hex'), hex_signature, 'hex')
    return is_valid
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

  function decrypt (key, data, callback) {
    fs.readFile(getCertDir() + 'peertube.key.pem', function (err, file) {
      if (err) return callback(err)

      var my_private_key = ursa.createPrivateKey(file)
      var decrypted_key = my_private_key.decrypt(key, 'hex', 'utf8')
      var decrypted_data = symetricDecrypt(data, decrypted_key)

      return callback(null, decrypted_data)
    })
  }

  function encrypt (public_key, data, callback) {
    var crt = ursa.createPublicKey(public_key)

    symetricEncrypt(data, function (err, dataEncrypted) {
      if (err) return callback(err)

      var key = crt.encrypt(dataEncrypted.password, 'utf8', 'hex')
      var encrypted = {
        data: dataEncrypted.crypted,
        key: key
      }

      callback(null, encrypted)
    })
  }

  function getCertDir () {
    return certDir
  }

  function sign (data) {
    var myKey = ursa.createPrivateKey(fs.readFileSync(certDir + 'peertube.key.pem'))
    var signature = myKey.hashAndSign('sha256', data, 'utf8', 'hex')

    return signature
  }

  // ---------------------------------------------------------------------------

  module.exports = peertubeCrypto

  // ---------------------------------------------------------------------------

  function certsExist (callback) {
    fs.exists(certDir + 'peertube.key.pem', function (exists) {
      return callback(exists)
    })
  }

  function createCerts (callback) {
    certsExist(function (exist) {
      if (exist === true) {
        var string = 'Certs already exist.'
        logger.warning(string)
        return callback(new Error(string))
      }

      logger.info('Generating a RSA key...')
      openssl.exec('genrsa', { 'out': certDir + 'peertube.key.pem', '2048': false }, function (err) {
        if (err) {
          logger.error('Cannot create private key on this pod.')
          return callback(err)
        }
        logger.info('RSA key generated.')

        logger.info('Manage public key...')
        openssl.exec('rsa', { 'in': certDir + 'peertube.key.pem', 'pubout': true, 'out': certDir + 'peertube.pub' }, function (err) {
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
    var decipher = crypto.createDecipher(algorithm, password)
    var dec = decipher.update(text, 'hex', 'utf8')
    dec += decipher.final('utf8')
    return dec
  }

  function symetricEncrypt (text, callback) {
    generatePassword(function (err, password) {
      if (err) return callback(err)

      var cipher = crypto.createCipher(algorithm, password)
      var crypted = cipher.update(text, 'utf8', 'hex')
      crypted += cipher.final('hex')
      callback(null, { crypted: crypted, password: password })
    })
  }
})()
