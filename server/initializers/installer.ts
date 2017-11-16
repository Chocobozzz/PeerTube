import * as passwordGenerator from 'password-generator'
import { UserRole } from '../../shared'
import { logger, mkdirpPromise, rimrafPromise } from '../helpers'
import { createUserAccountAndChannel } from '../lib'
import { createLocalAccountWithoutKeys } from '../lib/user'
import { applicationExist, clientsExist, usersExist } from './checker'
import { CACHE, CONFIG, LAST_MIGRATION_VERSION, SERVER_ACCOUNT_NAME } from './constants'
import { database as db } from './database'

async function installApplication () {
  try {
    await db.sequelize.sync()
    await removeCacheDirectories()
    await createDirectoriesIfNotExist()
    await createApplicationIfNotExist()
    await createOAuthClientIfNotExist()
    await createOAuthAdminIfNotExist()
  } catch (err) {
    logger.error('Cannot install application.', err)
    throw err
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
  const exist = await clientsExist(db.OAuthClient)
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

  const createdClient = await client.save()
  logger.info('Client id: ' + createdClient.clientId)
  logger.info('Client secret: ' + createdClient.clientSecret)

  return undefined
}

async function createOAuthAdminIfNotExist () {
  const exist = await usersExist(db.User)
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
  const user = db.User.build(userData)

  await createUserAccountAndChannel(user, validatePassword)
  logger.info('Username: ' + username)
  logger.info('User password: ' + password)
}

async function createApplicationIfNotExist () {
  const exist = await applicationExist(db.Application)
  // Nothing to do, application already exist
  if (exist === true) return undefined

  logger.info('Creating Application table.')
  const applicationInstance = await db.Application.create({ migrationVersion: LAST_MIGRATION_VERSION })

  logger.info('Creating application account.')

  return createLocalAccountWithoutKeys(SERVER_ACCOUNT_NAME, null, applicationInstance.id, undefined)
}
