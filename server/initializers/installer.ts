import { join } from 'path'
import * as config from 'config'
import { each, series } from 'async'
import * as mkdirp from 'mkdirp'
import * as passwordGenerator from 'password-generator'

import { database as db } from './database'
import { USER_ROLES, CONFIG, LAST_MIGRATION_VERSION } from './constants'
import { clientsExist, usersExist } from './checker'
import { logger, createCertsIfNotExist, root } from '../helpers'

function installApplication (callback: (err: Error) => void) {
  series([
    function createDatabase (callbackAsync) {
      db.sequelize.sync().asCallback(callbackAsync)
      // db.sequelize.sync({ force: true }).asCallback(callbackAsync)
    },

    function createDirectories (callbackAsync) {
      createDirectoriesIfNotExist(callbackAsync)
    },

    function createCertificates (callbackAsync) {
      createCertsIfNotExist(callbackAsync)
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

export {
  installApplication
}

// ---------------------------------------------------------------------------

function createDirectoriesIfNotExist (callback: (err: Error) => void) {
  const storages = config.get('storage')

  each(Object.keys(storages), function (key, callbackEach) {
    const dir = storages[key]
    mkdirp(join(root(), dir), callbackEach)
  }, callback)
}

function createOAuthClientIfNotExist (callback: (err: Error) => void) {
  clientsExist(function (err, exist) {
    if (err) return callback(err)

    // Nothing to do, clients already exist
    if (exist === true) return callback(null)

    logger.info('Creating a default OAuth Client.')

    const id = passwordGenerator(32, false, /[a-z0-9]/)
    const secret = passwordGenerator(32, false, /[a-zA-Z0-9]/)
    const client = db.OAuthClient.build({
      clientId: id,
      clientSecret: secret,
      grants: [ 'password', 'refresh_token' ],
      redirectUris: null
    })

    client.save().asCallback(function (err, createdClient) {
      if (err) return callback(err)

      logger.info('Client id: ' + createdClient.clientId)
      logger.info('Client secret: ' + createdClient.clientSecret)

      return callback(null)
    })
  })
}

function createOAuthAdminIfNotExist (callback: (err: Error) => void) {
  usersExist(function (err, exist) {
    if (err) return callback(err)

    // Nothing to do, users already exist
    if (exist === true) return callback(null)

    logger.info('Creating the administrator.')

    const username = 'root'
    const role = USER_ROLES.ADMIN
    const email = CONFIG.ADMIN.EMAIL
    const createOptions: { validate?: boolean } = {}
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
      db.Application.create({ migrationVersion: LAST_MIGRATION_VERSION }).asCallback(callback)
    })
  })
}
