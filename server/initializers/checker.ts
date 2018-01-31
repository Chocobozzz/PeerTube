import * as config from 'config'
import { promisify0 } from '../helpers/core-utils'
import { UserModel } from '../models/account/user'
import { ApplicationModel } from '../models/application/application'
import { OAuthClientModel } from '../models/oauth/oauth-client'

// Some checks on configuration files
function checkConfig () {
  if (config.has('webserver.host')) {
    let errorMessage = '`host` config key was renamed to `hostname` but it seems you still have a `host` key in your configuration files!'
    errorMessage += ' Please ensure to rename your `host` configuration to `hostname`.'

    return errorMessage
  }

  return null
}

// Check the config files
function checkMissedConfig () {
  const required = [ 'listen.port',
    'webserver.https', 'webserver.hostname', 'webserver.port',
    'database.hostname', 'database.port', 'database.suffix', 'database.username', 'database.password',
    'storage.videos', 'storage.logs', 'storage.thumbnails', 'storage.previews', 'storage.torrents', 'storage.cache', 'log.level',
    'cache.previews.size', 'admin.email', 'signup.enabled', 'signup.limit', 'transcoding.enabled', 'transcoding.threads',
    'user.video_quota', 'smtp.hostname', 'smtp.port', 'smtp.username', 'smtp.password', 'smtp.tls', 'smtp.from_address',
    'instance.name', 'instance.description', 'instance.terms'
  ]
  const miss: string[] = []

  for (const key of required) {
    if (!config.has(key)) {
      miss.push(key)
    }
  }

  return miss
}

// Check the available codecs
// We get CONFIG by param to not import it in this file (import orders)
async function checkFFmpeg (CONFIG: { TRANSCODING: { ENABLED: boolean } }) {
  const Ffmpeg = require('fluent-ffmpeg')
  const getAvailableCodecsPromise = promisify0(Ffmpeg.getAvailableCodecs)

  const codecs = await getAvailableCodecsPromise()
  if (CONFIG.TRANSCODING.ENABLED === false) return undefined

  const canEncode = [ 'libx264' ]
  for (const codec of canEncode) {
    if (codecs[codec] === undefined) {
      throw new Error('Unknown codec ' + codec + ' in FFmpeg.')
    }

    if (codecs[codec].canEncode !== true) {
      throw new Error('Unavailable encode codec ' + codec + ' in FFmpeg')
    }
  }
}

// We get db by param to not import it in this file (import orders)
async function clientsExist () {
  const totalClients = await OAuthClientModel.countTotal()

  return totalClients !== 0
}

// We get db by param to not import it in this file (import orders)
async function usersExist () {
  const totalUsers = await UserModel.countTotal()

  return totalUsers !== 0
}

// We get db by param to not import it in this file (import orders)
async function applicationExist () {
  const totalApplication = await ApplicationModel.countTotal()

  return totalApplication !== 0
}

// ---------------------------------------------------------------------------

export {
  checkConfig,
  checkFFmpeg,
  checkMissedConfig,
  clientsExist,
  usersExist,
  applicationExist
}
