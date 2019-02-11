import * as passwordGenerator from 'password-generator'
import { UserRole } from '../../shared'
import { logger } from '../helpers/logger'
import { createApplicationActor, createUserAccountAndChannel } from '../lib/user'
import { UserModel } from '../models/account/user'
import { ApplicationModel } from '../models/application/application'
import { OAuthClientModel } from '../models/oauth/oauth-client'
import { applicationExist, clientsExist, usersExist } from './checker-after-init'
import { CACHE, CONFIG, HLS_PLAYLIST_DIRECTORY, LAST_MIGRATION_VERSION } from './constants'
import { sequelizeTypescript } from './database'
import { remove, ensureDir } from 'fs-extra'

async function installApplication () {
  try {
    await Promise.all([
      // Database related
      sequelizeTypescript.sync()
        .then(() => {
          return Promise.all([
            createApplicationIfNotExist(),
            createOAuthClientIfNotExist(),
            createOAuthAdminIfNotExist()
          ])
        }),

      // Directories
      removeCacheDirectories()
        .then(() => createDirectoriesIfNotExist())
    ])
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
  const cacheDirectories = Object.keys(CACHE)
    .map(k => CACHE[k].DIRECTORY)

  const tasks: Promise<any>[] = []

  // Cache directories
  for (const key of Object.keys(cacheDirectories)) {
    const dir = cacheDirectories[key]
    tasks.push(remove(dir))
  }

  return Promise.all(tasks)
}

function createDirectoriesIfNotExist () {
  const storage = CONFIG.STORAGE
  const cacheDirectories = Object.keys(CACHE)
                                 .map(k => CACHE[k].DIRECTORY)

  const tasks: Promise<void>[] = []
  for (const key of Object.keys(storage)) {
    const dir = storage[key]
    tasks.push(ensureDir(dir))
  }

  // Cache directories
  for (const key of Object.keys(cacheDirectories)) {
    const dir = cacheDirectories[key]
    tasks.push(ensureDir(dir))
  }

  // Playlist directories
  tasks.push(ensureDir(HLS_PLAYLIST_DIRECTORY))

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
    password = passwordGenerator(16, true)
  }

  const userData = {
    username,
    email,
    password,
    role,
    verified: true,
    nsfwPolicy: CONFIG.INSTANCE.DEFAULT_NSFW_POLICY,
    videoQuota: -1,
    videoQuotaDaily: -1
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

  logger.info('Creating application account.')

  const application = await ApplicationModel.create({
    migrationVersion: LAST_MIGRATION_VERSION
  })

  return createApplicationActor(application.id)
}
