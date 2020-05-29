import * as config from 'config'
import { promisify0 } from '../helpers/core-utils'
import { logger } from '../helpers/logger'

// ONLY USE CORE MODULES IN THIS FILE!

// Check the config files
function checkMissedConfig () {
  const required = [ 'listen.port', 'listen.hostname',
    'webserver.https', 'webserver.hostname', 'webserver.port',
    'trust_proxy',
    'database.hostname', 'database.port', 'database.suffix', 'database.username', 'database.password', 'database.pool.max',
    'smtp.hostname', 'smtp.port', 'smtp.username', 'smtp.password', 'smtp.tls', 'smtp.from_address',
    'email.body.signature', 'email.subject.prefix',
    'storage.avatars', 'storage.videos', 'storage.logs', 'storage.previews', 'storage.thumbnails', 'storage.torrents', 'storage.cache',
    'storage.redundancy', 'storage.tmp', 'storage.streaming_playlists', 'storage.plugins',
    'log.level',
    'user.video_quota', 'user.video_quota_daily',
    'csp.enabled', 'csp.report_only', 'csp.report_uri',
    'cache.previews.size', 'admin.email', 'contact_form.enabled',
    'signup.enabled', 'signup.limit', 'signup.requires_email_verification',
    'signup.filters.cidr.whitelist', 'signup.filters.cidr.blacklist',
    'redundancy.videos.strategies', 'redundancy.videos.check_interval',
    'transcoding.enabled', 'transcoding.threads', 'transcoding.allow_additional_extensions', 'transcoding.hls.enabled',
    'transcoding.resolutions.0p', 'transcoding.resolutions.240p', 'transcoding.resolutions.360p', 'transcoding.resolutions.480p',
    'transcoding.resolutions.720p', 'transcoding.resolutions.1080p', 'transcoding.resolutions.2160p',
    'import.videos.http.enabled', 'import.videos.torrent.enabled', 'auto_blacklist.videos.of_users.enabled',
    'trending.videos.interval_days',
    'instance.name', 'instance.short_description', 'instance.description', 'instance.terms', 'instance.default_client_route',
    'instance.is_nsfw', 'instance.default_nsfw_policy', 'instance.robots', 'instance.securitytxt',
    'services.twitter.username', 'services.twitter.whitelisted',
    'followers.instance.enabled', 'followers.instance.manual_approval',
    'tracker.enabled', 'tracker.private', 'tracker.reject_too_many_announces',
    'history.videos.max_age', 'views.videos.remote.max_age',
    'rates_limit.login.window', 'rates_limit.login.max', 'rates_limit.ask_send_email.window', 'rates_limit.ask_send_email.max',
    'theme.default',
    'remote_redundancy.videos.accept_from',
    'federation.videos.federate_unlisted',
    'search.remote_uri.users', 'search.remote_uri.anonymous', 'search.search_index.enabled', 'search.search_index.url',
    'search.search_index.disable_local_search', 'search.search_index.is_default_search'
  ]
  const requiredAlternatives = [
    [ // set
      [ 'redis.hostname', 'redis.port' ], // alternative
      [ 'redis.socket' ]
    ]
  ]
  const miss: string[] = []

  for (const key of required) {
    if (!config.has(key)) {
      miss.push(key)
    }
  }

  const redundancyVideos = config.get<any>('redundancy.videos.strategies')

  if (Array.isArray(redundancyVideos)) {
    for (const r of redundancyVideos) {
      if (!r.size) miss.push('redundancy.videos.strategies.size')
      if (!r.min_lifetime) miss.push('redundancy.videos.strategies.min_lifetime')
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
  if (CONFIG.TRANSCODING.ENABLED === false) return undefined

  const Ffmpeg = require('fluent-ffmpeg')
  const getAvailableCodecsPromise = promisify0(Ffmpeg.getAvailableCodecs)
  const codecs = await getAvailableCodecsPromise()
  const canEncode = [ 'libx264' ]

  for (const codec of canEncode) {
    if (codecs[codec] === undefined) {
      throw new Error('Unknown codec ' + codec + ' in FFmpeg.')
    }

    if (codecs[codec].canEncode !== true) {
      throw new Error('Unavailable encode codec ' + codec + ' in FFmpeg')
    }
  }

  return checkFFmpegEncoders()
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
    supportedOptionalEncoders.set(encoder, encoders[encoder] !== undefined)
  }

  return supportedOptionalEncoders
}

function checkNodeVersion () {
  const v = process.version
  const majorString = v.split('.')[0].replace('v', '')
  const major = parseInt(majorString, 10)

  logger.debug('Checking NodeJS version %s.', v)

  if (major < 10) {
    logger.warn('Your NodeJS version %s is deprecated. Please use Node 10.', v)
  }
}

// ---------------------------------------------------------------------------

export {
  checkFFmpeg,
  checkFFmpegEncoders,
  checkMissedConfig,
  checkNodeVersion
}
