'use strict'

const async = require('async')
const config = require('config')
const mkdirp = require('mkdirp')
const passwordGenerator = require('password-generator')
const path = require('path')

const checker = require('./checker')
const logger = require('../helpers/logger')
const peertubeCrypto = require('../helpers/peertubeCrypto')
const Users = require('../models/users')

const installer = {
  installApplication: installApplication
}

function installApplication (callback) {
  async.series([
    function createDirectories (callbackAsync) {
      createDirectoriesIfNotExist(callbackAsync)
    },

    function createCertificates (callbackAsync) {
      peertubeCrypto.createCertsIfNotExist(callbackAsync)
    },

    function createOAuthClient (callbackAsync) {
      createOAuthClientIfNotExist(callbackAsync)
    },

    function createOAuthUser (callbackAsync) {
      createOAuthUserIfNotExist(callbackAsync)
    }
  ], callback)
}

// ---------------------------------------------------------------------------

module.exports = installer

// ---------------------------------------------------------------------------

function createDirectoriesIfNotExist (callback) {
  const storages = config.get('storage')

  async.each(Object.keys(storages), function (key, callbackEach) {
    const dir = storages[key]
    mkdirp(path.join(__dirname, '..', '..', dir), callbackEach)
  }, callback)
}

function createOAuthClientIfNotExist (callback) {
  checker.clientsExist(function (err, exist) {
    if (err) return callback(err)

    // Nothing to do, clients already exist
    if (exist === true) return callback(null)

    logger.info('Creating a default OAuth Client.')

    const secret = passwordGenerator(32, false)
    Users.createClient(secret, [ 'password' ], function (err, id) {
      if (err) return callback(err)

      logger.info('Client id: ' + id)
      logger.info('Client secret: ' + secret)

      return callback(null)
    })
  })
}

function createOAuthUserIfNotExist (callback) {
  checker.usersExist(function (err, exist) {
    if (err) return callback(err)

    // Nothing to do, users already exist
    if (exist === true) return callback(null)

    logger.info('Creating the administrator.')

    const username = 'root'
    let password = ''

    // Do not generate a random password for tests
    if (process.env.NODE_ENV === 'test') {
      password = 'test'

      if (process.env.NODE_APP_INSTANCE) {
        password += process.env.NODE_APP_INSTANCE
      }
    } else {
      password = passwordGenerator(8, true)
    }

    Users.createUser(username, password, function (err) {
      if (err) return callback(err)

      logger.info('Username: ' + username)
      logger.info('User password: ' + password)

      return callback(null)
    })
  })
}
