import { ensureDir, readdir, remove } from 'fs-extra'
import passwordGenerator from 'password-generator'
import { join } from 'path'
import { isTestOrDevInstance } from '@server/helpers/core-utils'
import { getNodeABIVersion } from '@server/helpers/version'
import { UserRole } from '@shared/models'
import { logger } from '../helpers/logger'
import { buildUser, createApplicationActor, createUserAccountAndChannelAndPlaylist } from '../lib/user'
import { ApplicationModel } from '../models/application/application'
import { OAuthClientModel } from '../models/oauth/oauth-client'
import { applicationExist, clientsExist, usersExist } from './checker-after-init'
import { CONFIG } from './config'
import { FILES_CACHE, HLS_STREAMING_PLAYLIST_DIRECTORY, LAST_MIGRATION_VERSION, RESUMABLE_UPLOAD_DIRECTORY } from './constants'
import { sequelizeTypescript } from './database'

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
      removeCacheAndTmpDirectories()
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

function removeCacheAndTmpDirectories () {
  const cacheDirectories = Object.keys(FILES_CACHE)
    .map(k => FILES_CACHE[k].DIRECTORY)

  const tasks: Promise<any>[] = []

  // Cache directories
  for (const key of Object.keys(cacheDirectories)) {
    const dir = cacheDirectories[key]
    tasks.push(removeDirectoryOrContent(dir))
  }

  tasks.push(removeDirectoryOrContent(CONFIG.STORAGE.TMP_DIR))

  return Promise.all(tasks)
}

async function removeDirectoryOrContent (dir: string) {
  try {
    await remove(dir)
  } catch (err) {
    logger.debug('Cannot remove directory %s. Removing content instead.', dir, { err })

    const files = await readdir(dir)

    for (const file of files) {
      await remove(join(dir, file))
    }
  }
}

function createDirectoriesIfNotExist () {
  const storage = CONFIG.STORAGE
  const cacheDirectories = Object.keys(FILES_CACHE)
                                 .map(k => FILES_CACHE[k].DIRECTORY)

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
  tasks.push(ensureDir(HLS_STREAMING_PLAYLIST_DIRECTORY))

  // Resumable upload directory
  tasks.push(ensureDir(RESUMABLE_UPLOAD_DIRECTORY))

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

  // Do not generate a random password for test and dev environments
  if (isTestOrDevInstance()) {
    password = 'test'

    if (process.env.NODE_APP_INSTANCE) {
      password += process.env.NODE_APP_INSTANCE
    }

    // Our password is weak so do not validate it
    validatePassword = false
  } else if (process.env.PT_INITIAL_ROOT_PASSWORD) {
    password = process.env.PT_INITIAL_ROOT_PASSWORD
  } else {
    password = passwordGenerator(16, true)
  }

  const user = buildUser({
    username,
    email,
    password,
    role,
    emailVerified: true,
    videoQuota: -1,
    videoQuotaDaily: -1
  })

  await createUserAccountAndChannelAndPlaylist({ userToCreate: user, channelNames: undefined, validateUser: validatePassword })
  logger.info('Username: ' + username)
  logger.info('User password: ' + password)
}

async function createApplicationIfNotExist () {
  const exist = await applicationExist()
  // Nothing to do, application already exist
  if (exist === true) return undefined

  logger.info('Creating application account.')

  const application = await ApplicationModel.create({
    migrationVersion: LAST_MIGRATION_VERSION,
    nodeVersion: process.version,
    nodeABIVersion: getNodeABIVersion()
  })

  return createApplicationActor(application.id)
}
