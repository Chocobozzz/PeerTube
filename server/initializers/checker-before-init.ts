import { IConfig } from 'config'
import { parseSemVersion, promisify0 } from '../helpers/core-utils'
import { logger } from '../helpers/logger'

// Special behaviour for config because we can reload it
const config: IConfig = require('config')

// ONLY USE CORE MODULES IN THIS FILE!

// Check the config files
function checkMissedConfig () {
  const required = [ 'listen.port', 'listen.hostname',
    'webserver.https', 'webserver.hostname', 'webserver.port',
    'trust_proxy',
    'database.hostname', 'database.port', 'database.username', 'database.password', 'database.pool.max',
    'smtp.hostname', 'smtp.port', 'smtp.username', 'smtp.password', 'smtp.tls', 'smtp.from_address',
    'email.body.signature', 'email.subject.prefix',
    'storage.avatars', 'storage.videos', 'storage.logs', 'storage.previews', 'storage.thumbnails', 'storage.torrents', 'storage.cache',
    'storage.redundancy', 'storage.tmp', 'storage.streaming_playlists', 'storage.plugins', 'storage.well_known',
    'log.level',
    'user.video_quota', 'user.video_quota_daily',
    'video_channels.max_per_user',
    'csp.enabled', 'csp.report_only', 'csp.report_uri',
    'security.frameguard.enabled',
    'cache.previews.size', 'cache.captions.size', 'cache.torrents.size', 'admin.email', 'contact_form.enabled',
    'signup.enabled', 'signup.limit', 'signup.requires_email_verification', 'signup.minimum_age',
    'signup.filters.cidr.whitelist', 'signup.filters.cidr.blacklist',
    'redundancy.videos.strategies', 'redundancy.videos.check_interval',
    'transcoding.enabled', 'transcoding.threads', 'transcoding.allow_additional_extensions', 'transcoding.hls.enabled',
    'transcoding.profile', 'transcoding.concurrency',
    'transcoding.resolutions.0p', 'transcoding.resolutions.144p', 'transcoding.resolutions.240p', 'transcoding.resolutions.360p',
    'transcoding.resolutions.480p', 'transcoding.resolutions.720p', 'transcoding.resolutions.1080p', 'transcoding.resolutions.1440p',
    'transcoding.resolutions.2160p', 'transcoding.always_transcode_original_resolution', 'video_studio.enabled',
    'import.videos.http.enabled', 'import.videos.torrent.enabled', 'import.videos.concurrency', 'import.videos.timeout',
    'import.video_channel_synchronization.enabled', 'import.video_channel_synchronization.max_per_user',
    'import.video_channel_synchronization.check_interval', 'import.video_channel_synchronization.videos_limit_per_synchronization',
    'auto_blacklist.videos.of_users.enabled', 'trending.videos.interval_days',
    'client.videos.miniature.display_author_avatar',
    'client.videos.miniature.prefer_author_display_name', 'client.menu.login.redirect_on_single_external_auth',
    'defaults.publish.download_enabled', 'defaults.publish.comments_enabled', 'defaults.publish.privacy', 'defaults.publish.licence',
    'instance.name', 'instance.short_description', 'instance.description', 'instance.terms', 'instance.default_client_route',
    'instance.is_nsfw', 'instance.default_nsfw_policy', 'instance.robots', 'instance.securitytxt',
    'services.twitter.username', 'services.twitter.whitelisted',
    'followers.instance.enabled', 'followers.instance.manual_approval',
    'tracker.enabled', 'tracker.private', 'tracker.reject_too_many_announces',
    'history.videos.max_age', 'views.videos.remote.max_age', 'views.videos.local_buffer_update_interval', 'views.videos.ip_view_expiration',
    'rates_limit.login.window', 'rates_limit.login.max', 'rates_limit.ask_send_email.window', 'rates_limit.ask_send_email.max',
    'theme.default',
    'feeds.videos.count', 'feeds.comments.count',
    'geo_ip.enabled', 'geo_ip.country.database_url',
    'remote_redundancy.videos.accept_from',
    'federation.videos.federate_unlisted', 'federation.videos.cleanup_remote_interactions',
    'peertube.check_latest_version.enabled', 'peertube.check_latest_version.url',
    'search.remote_uri.users', 'search.remote_uri.anonymous', 'search.search_index.enabled', 'search.search_index.url',
    'search.search_index.disable_local_search', 'search.search_index.is_default_search',
    'live.enabled', 'live.allow_replay', 'live.latency_setting.enabled', 'live.max_duration',
    'live.max_user_lives', 'live.max_instance_lives',
    'live.rtmp.enabled', 'live.rtmp.port', 'live.rtmp.hostname', 'live.rtmp.public_hostname',
    'live.rtmps.enabled', 'live.rtmps.port', 'live.rtmps.hostname', 'live.rtmps.public_hostname',
    'live.rtmps.key_file', 'live.rtmps.cert_file',
    'live.transcoding.enabled', 'live.transcoding.threads', 'live.transcoding.profile',
    'live.transcoding.resolutions.144p', 'live.transcoding.resolutions.240p', 'live.transcoding.resolutions.360p',
    'live.transcoding.resolutions.480p', 'live.transcoding.resolutions.720p', 'live.transcoding.resolutions.1080p',
    'live.transcoding.resolutions.1440p', 'live.transcoding.resolutions.2160p', 'live.transcoding.always_transcode_original_resolution'
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
}

function checkNodeVersion () {
  const v = process.version
  const { major } = parseSemVersion(v)

  logger.debug('Checking NodeJS version %s.', v)

  if (major <= 12) {
    throw new Error('Your NodeJS version ' + v + ' is not supported. Please upgrade.')
  }
}

// ---------------------------------------------------------------------------

export {
  checkFFmpeg,
  checkMissedConfig,
  checkNodeVersion
}
