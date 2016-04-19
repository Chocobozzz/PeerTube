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
  // Creates directories
  createDirectoriesIfNotExist(function (err) {
    if (err) return callback(err)

    // ----------- Create the certificates if they don't already exist -----------
    peertubeCrypto.createCertsIfNotExist(function (err) {
      if (err) return callback(err)

      createOAuthClientIfNotExist(function (err) {
        if (err) return callback(err)

        createOAuthUserIfNotExist(callback)
      })
    })
  })
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
    const password = passwordGenerator(8, true)

    Users.createUser(username, password, function (err) {
      if (err) return callback(err)

      logger.info('Username: ' + username)
      logger.info('User password: ' + password)

      return callback(null)
    })
  })
}
