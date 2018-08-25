import * as config from 'config'
import { promisify0 } from '../helpers/core-utils'
import { UserModel } from '../models/account/user'
import { ApplicationModel } from '../models/application/application'
import { OAuthClientModel } from '../models/oauth/oauth-client'
import { parse } from 'url'
import { CONFIG } from './constants'
import { logger } from '../helpers/logger'
import { getServerActor } from '../helpers/utils'

async function checkActivityPubUrls () {
  const actor = await getServerActor()

  const parsed = parse(actor.url)
  if (CONFIG.WEBSERVER.HOST !== parsed.host) {
    const NODE_ENV = config.util.getEnv('NODE_ENV')
    const NODE_CONFIG_DIR = config.util.getEnv('NODE_CONFIG_DIR')

    logger.warn(
      'It seems PeerTube was started (and created some data) with another domain name. ' +
      'This means you will not be able to federate! ' +
      'Please use %s %s npm run update-host to fix this.',
      NODE_CONFIG_DIR ? `NODE_CONFIG_DIR=${NODE_CONFIG_DIR}` : '',
      NODE_ENV ? `NODE_ENV=${NODE_ENV}` : ''
    )
  }
}

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
    'database.hostname', 'database.port', 'database.suffix', 'database.username', 'database.password', 'database.pool.max',
    'smtp.hostname', 'smtp.port', 'smtp.username', 'smtp.password', 'smtp.tls', 'smtp.from_address',
    'storage.avatars', 'storage.videos', 'storage.logs', 'storage.previews', 'storage.thumbnails', 'storage.torrents', 'storage.cache',
    'log.level',
    'user.video_quota',
    'cache.previews.size', 'admin.email',
    'signup.enabled', 'signup.limit', 'signup.filters.cidr.whitelist', 'signup.filters.cidr.blacklist',
    'transcoding.enabled', 'transcoding.threads',
    'import.videos.http.enabled',
    'instance.name', 'instance.short_description', 'instance.description', 'instance.terms', 'instance.default_client_route',
    'instance.default_nsfw_policy', 'instance.robots',
    'services.twitter.username', 'services.twitter.whitelisted'
  ]
  const requiredAlternatives = [
    [ // set
      ['redis.hostname', 'redis.port'], // alternative
      ['redis.socket']
    ]
  ]
  const miss: string[] = []

  for (const key of required) {
    if (!config.has(key)) {
      miss.push(key)
    }
  }

  const missingAlternatives = requiredAlternatives.filter(
    set => !set.find(alternative => !alternative.find(key => !config.has(key)))
  )

  missingAlternatives
    .forEach(set => set[0].forEach(key => miss.push(key)))

  return miss
}

// Check the available codecs
// We get CONFIG by param to not import it in this file (import orders)
async function checkFFmpeg (CONFIG: { TRANSCODING: { ENABLED: boolean } }) {
  const Ffmpeg = require('fluent-ffmpeg')
  const getAvailableCodecsPromise = promisify0(Ffmpeg.getAvailableCodecs)
  const codecs = await getAvailableCodecsPromise()
  const canEncode = [ 'libx264' ]

  if (CONFIG.TRANSCODING.ENABLED === false) return undefined

  for (const codec of canEncode) {
    if (codecs[codec] === undefined) {
      throw new Error('Unknown codec ' + codec + ' in FFmpeg.')
    }

    if (codecs[codec].canEncode !== true) {
      throw new Error('Unavailable encode codec ' + codec + ' in FFmpeg')
    }
  }

  checkFFmpegEncoders()
}

// Optional encoders, if present, can be used to improve transcoding
// Here we ask ffmpeg if it detects their presence on the system, so that we can later use them
let supportedOptionalEncoders: Map<string, boolean>
async function checkFFmpegEncoders (): Promise<Map<string, boolean>> {
  if (supportedOptionalEncoders !== undefined) {
    return supportedOptionalEncoders
  }

  const Ffmpeg = require('fluent-ffmpeg')
  const getAvailableEncodersPromise = promisify0(Ffmpeg.getAvailableEncoders)
  const encoders = await getAvailableEncodersPromise()
  const optionalEncoders = [ 'libfdk_aac' ]
  supportedOptionalEncoders = new Map<string, boolean>()

  for (const encoder of optionalEncoders) {
    supportedOptionalEncoders.set(encoder,
      encoders[encoder] !== undefined
    )
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
  checkFFmpegEncoders,
  checkMissedConfig,
  clientsExist,
  usersExist,
  applicationExist,
  checkActivityPubUrls
}
