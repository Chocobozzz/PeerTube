'use strict'

const config = require('config')
const each = require('async/each')
const mkdirp = require('mkdirp')
const passwordGenerator = require('password-generator')
const path = require('path')
const series = require('async/series')

const checker = require('./checker')
const constants = require('./constants')
const db = require('./database')
const logger = require('../helpers/logger')
const peertubeCrypto = require('../helpers/peertube-crypto')

const installer = {
  installApplication
}

function installApplication (callback) {
  series([
    function createDatabase (callbackAsync) {
      db.sequelize.sync().asCallback(callbackAsync)
      // db.sequelize.sync({ force: true }).asCallback(callbackAsync)
    },

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

    const id = passwordGenerator(32, false, /[a-z0-9]/)
    const secret = passwordGenerator(32, false, /[a-zA-Z0-9]/)
    const client = db.OAuthClient.build({
      clientId: id,
      clientSecret: secret,
      grants: [ 'password', 'refresh_token' ]
    })

    client.save().asCallback(function (err, createdClient) {
      if (err) return callback(err)

      logger.info('Client id: ' + createdClient.clientId)
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
    const email = constants.CONFIG.ADMIN.EMAIL
    const createOptions = {}
    let password = ''

    // Do not generate a random password for tests
    if (process.env.NODE_ENV === 'test') {
      password = 'test'

      if (process.env.NODE_APP_INSTANCE) {
        password += process.env.NODE_APP_INSTANCE
      }

      // Our password is weak so do not validate it
      createOptions.validate = false
    } else {
      password = passwordGenerator(8, true)
    }

    const userData = {
      username,
      email,
      password,
      role
    }

    db.User.create(userData, createOptions).asCallback(function (err, createdUser) {
      if (err) return callback(err)

      logger.info('Username: ' + username)
      logger.info('User password: ' + password)

      logger.info('Creating Application table.')
      db.Application.create({ migrationVersion: constants.LAST_MIGRATION_VERSION }).asCallback(callback)
    })
  })
}
