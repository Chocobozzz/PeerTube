import * as passwordGenerator from 'password-generator'
import * as Promise from 'bluebird'

import { database as db } from './database'
import { USER_ROLES, CONFIG, LAST_MIGRATION_VERSION, CACHE } from './constants'
import { clientsExist, usersExist } from './checker'
import { logger, createCertsIfNotExist, mkdirpPromise, rimrafPromise } from '../helpers'

function installApplication () {
  return db.sequelize.sync()
    .then(() => removeCacheDirectories())
    .then(() => createDirectoriesIfNotExist())
    .then(() => createCertsIfNotExist())
    .then(() => createOAuthClientIfNotExist())
    .then(() => createOAuthAdminIfNotExist())
}

// ---------------------------------------------------------------------------

export {
  installApplication
}

// ---------------------------------------------------------------------------

function removeCacheDirectories () {
  const cacheDirectories = CACHE.DIRECTORIES

  const tasks = []

  // Cache directories
  Object.keys(cacheDirectories).forEach(key => {
    const dir = cacheDirectories[key]
    tasks.push(rimrafPromise(dir))
  })

  return Promise.all(tasks)
}

function createDirectoriesIfNotExist () {
  const storage = CONFIG.STORAGE
  const cacheDirectories = CACHE.DIRECTORIES

  const tasks = []
  Object.keys(storage).forEach(key => {
    const dir = storage[key]
    tasks.push(mkdirpPromise(dir))
  })

  // Cache directories
  Object.keys(cacheDirectories).forEach(key => {
    const dir = cacheDirectories[key]
    tasks.push(mkdirpPromise(dir))
  })

  return Promise.all(tasks)
}

function createOAuthClientIfNotExist () {
  return clientsExist(db.OAuthClient).then(exist => {
    // Nothing to do, clients already exist
    if (exist === true) return undefined

    logger.info('Creating a default OAuth Client.')

    const id = passwordGenerator(32, false, /[a-z0-9]/)
    const secret = passwordGenerator(32, false, /[a-zA-Z0-9]/)
    const client = db.OAuthClient.build({
      clientId: id,
      clientSecret: secret,
      grants: [ 'password', 'refresh_token' ],
      redirectUris: null
    })

    return client.save().then(createdClient => {
      logger.info('Client id: ' + createdClient.clientId)
      logger.info('Client secret: ' + createdClient.clientSecret)

      return undefined
    })
  })
}

function createOAuthAdminIfNotExist () {
  return usersExist(db.User).then(exist => {
    // Nothing to do, users already exist
    if (exist === true) return undefined

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
      role,
      videoQuota: -1
    }

    return db.User.create(userData, createOptions).then(createdUser => {
      logger.info('Username: ' + username)
      logger.info('User password: ' + password)

      logger.info('Creating Application table.')
      return db.Application.create({ migrationVersion: LAST_MIGRATION_VERSION })
    })
  })
}
