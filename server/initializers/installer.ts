import * as passwordGenerator from 'password-generator'
import { UserRole } from '../../shared'
import { mkdirpPromise, rimrafPromise } from '../helpers/core-utils'
import { logger } from '../helpers/logger'
import { createApplicationActor, createUserAccountAndChannel } from '../lib/user'
import { UserModel } from '../models/account/user'
import { ApplicationModel } from '../models/application/application'
import { OAuthClientModel } from '../models/oauth/oauth-client'
import { applicationExist, clientsExist, usersExist } from './checker'
import { CACHE, CONFIG, LAST_MIGRATION_VERSION } from './constants'
import { sequelizeTypescript } from './database'

async function installApplication () {
  try {
    await sequelizeTypescript.sync()
    await removeCacheDirectories()
    await createDirectoriesIfNotExist()
    await createApplicationIfNotExist()
    await createOAuthClientIfNotExist()
    await createOAuthAdminIfNotExist()
  } catch (err) {
    logger.error('Cannot install application.', { err })
    process.exit(-1)
  }
}

// ---------------------------------------------------------------------------

export {
  installApplication
}

// ---------------------------------------------------------------------------

function removeCacheDirectories () {
  const cacheDirectories = CACHE.DIRECTORIES

  const tasks: Promise<any>[] = []

  // Cache directories
  for (const key of Object.keys(cacheDirectories)) {
    const dir = cacheDirectories[key]
    tasks.push(rimrafPromise(dir))
  }

  return Promise.all(tasks)
}

function createDirectoriesIfNotExist () {
  const storage = CONFIG.STORAGE
  const cacheDirectories = CACHE.DIRECTORIES

  const tasks = []
  for (const key of Object.keys(storage)) {
    const dir = storage[key]
    tasks.push(mkdirpPromise(dir))
  }

  // Cache directories
  for (const key of Object.keys(cacheDirectories)) {
    const dir = cacheDirectories[key]
    tasks.push(mkdirpPromise(dir))
  }

  return Promise.all(tasks)
}

async function createOAuthClientIfNotExist () {
  const exist = await clientsExist()
  // Nothing to do, clients already exist
  if (exist === true) return undefined

  logger.info('Creating a default OAuth Client.')

  const id = passwordGenerator(32, false, /[a-z0-9]/)
  const secret = passwordGenerator(32, false, /[a-zA-Z0-9]/)
  const client = new OAuthClientModel({
    clientId: id,
    clientSecret: secret,
    grants: [ 'password', 'refresh_token' ],
    redirectUris: null
  })

  const createdClient = await client.save()
  logger.info('Client id: ' + createdClient.clientId)
  logger.info('Client secret: ' + createdClient.clientSecret)

  return undefined
}

async function createOAuthAdminIfNotExist () {
  const exist = await usersExist()
  // Nothing to do, users already exist
  if (exist === true) return undefined

  logger.info('Creating the administrator.')

  const username = 'root'
  const role = UserRole.ADMINISTRATOR
  const email = CONFIG.ADMIN.EMAIL
  let validatePassword = true
  let password = ''

  // Do not generate a random password for tests
  if (process.env.NODE_ENV === 'test') {
    password = 'test'

    if (process.env.NODE_APP_INSTANCE) {
      password += process.env.NODE_APP_INSTANCE
    }

    // Our password is weak so do not validate it
    validatePassword = false
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
  const user = new UserModel(userData)

  await createUserAccountAndChannel(user, validatePassword)
  logger.info('Username: ' + username)
  logger.info('User password: ' + password)
}

async function createApplicationIfNotExist () {
  const exist = await applicationExist()
  // Nothing to do, application already exist
  if (exist === true) return undefined

  logger.info('Creating Application table.')

  logger.info('Creating application account.')

  const application = await ApplicationModel.create({
    migrationVersion: LAST_MIGRATION_VERSION
  })

  return createApplicationActor(application.id)
}
