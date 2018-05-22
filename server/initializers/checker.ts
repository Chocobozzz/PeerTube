import * as config from 'config'
import { promisify0 } from '../helpers/core-utils'
import { UserModel } from '../models/account/user'
import { ApplicationModel } from '../models/application/application'
import { OAuthClientModel } from '../models/oauth/oauth-client'

// Some checks on configuration files
// Return an error message, or null if everything is okay
function checkConfig () {
  const defaultNSFWPolicy = config.get<string>('instance.default_nsfw_policy')

  if ([ 'do_not_list', 'blur', 'display' ].indexOf(defaultNSFWPolicy) === -1) {
    return 'NSFW policy setting should be "do_not_list" or "blur" or "display" instead of ' + defaultNSFWPolicy
  }

  return null
}

// Check the config files
function checkMissedConfig () {
  const required = [ 'listen.port', 'listen.hostname',
    'webserver.https', 'webserver.hostname', 'webserver.port',
    'trust_proxy',
    'database.hostname', 'database.port', 'database.suffix', 'database.username', 'database.password',
    'redis.hostname', 'redis.port', 'redis.auth', 'redis.db',
    'smtp.hostname', 'smtp.port', 'smtp.username', 'smtp.password', 'smtp.tls', 'smtp.from_address',
    'storage.avatars', 'storage.videos', 'storage.logs', 'storage.previews', 'storage.thumbnails', 'storage.torrents', 'storage.cache',
    'log.level',
    'user.video_quota',
    'cache.previews.size', 'admin.email',
    'signup.enabled', 'signup.limit', 'signup.filters.cidr.whitelist', 'signup.filters.cidr.blacklist',
    'transcoding.enabled', 'transcoding.threads',
    'instance.name', 'instance.short_description', 'instance.description', 'instance.terms', 'instance.default_client_route',
    'instance.default_nsfw_policy', 'instance.robots',
    'services.twitter.username', 'services.twitter.whitelisted'
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
