'use strict'

const config = require('config')
const each = require('async/each')
const mkdirp = require('mkdirp')
const mongoose = require('mongoose')
const passwordGenerator = require('password-generator')
const path = require('path')
const series = require('async/series')

const checker = require('./checker')
const constants = require('./constants')
const logger = require('../helpers/logger')
const peertubeCrypto = require('../helpers/peertube-crypto')

const Client = mongoose.model('OAuthClient')
const User = mongoose.model('User')

const installer = {
  installApplication: installApplication
}

function installApplication (callback) {
  series([
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
      createOAuthAdminIfNotExist(callbackAsync)
    }
  ], callback)
}

// ---------------------------------------------------------------------------

module.exports = installer

// ---------------------------------------------------------------------------

function createDirectoriesIfNotExist (callback) {
  const storages = config.get('storage')

  each(Object.keys(storages), function (key, callbackEach) {
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
    const client = new Client({
      clientSecret: secret,
      grants: [ 'password', 'refresh_token' ]
    })

    client.save(function (err, createdClient) {
      if (err) return callback(err)

      logger.info('Client id: ' + createdClient._id)
      logger.info('Client secret: ' + createdClient.clientSecret)

      return callback(null)
    })
  })
}

function createOAuthAdminIfNotExist (callback) {
  checker.usersExist(function (err, exist) {
    if (err) return callback(err)

    // Nothing to do, users already exist
    if (exist === true) return callback(null)

    logger.info('Creating the administrator.')

    const username = 'root'
    const role = constants.USER_ROLES.ADMIN
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

    const user = new User({
      username: username,
      password: password,
      role: role
    })

    user.save(function (err, createdUser) {
      if (err) return callback(err)

      logger.info('Username: ' + createdUser.username)
      logger.info('User password: ' + createdUser.password)

      return callback(null)
    })
  })
}
