import { IConfig } from 'config'
import { dirname, join } from 'path'
import { VideosRedundancyStrategy } from '../../shared/models'
// Do not use barrels, remain constants as independent as possible
import { buildPath, parseBytes, parseDurationToMs, root } from '../helpers/core-utils'
import { NSFWPolicyType } from '../../shared/models/videos/nsfw-policy.type'
import * as bytes from 'bytes'
import { VideoRedundancyConfigFilter } from '@shared/models/redundancy/video-redundancy-config-filter.type'
import { BroadcastMessageLevel } from '@shared/models/server'

// Use a variable to reload the configuration if we need
let config: IConfig = require('config')

const configChangedHandlers: Function[] = []

const CONFIG = {
  CUSTOM_FILE: getLocalConfigFilePath(),
  LISTEN: {
    PORT: config.get<number>('listen.port'),
    HOSTNAME: config.get<string>('listen.hostname')
  },
  DATABASE: {
    DBNAME: config.has('database.name') ? config.get<string>('database.name') : 'peertube' + config.get<string>('database.suffix'),
    HOSTNAME: config.get<string>('database.hostname'),
    PORT: config.get<number>('database.port'),
    USERNAME: config.get<string>('database.username'),
    PASSWORD: config.get<string>('database.password'),
    POOL: {
      MAX: config.get<number>('database.pool.max')
    }
  },
  REDIS: {
    HOSTNAME: config.has('redis.hostname') ? config.get<string>('redis.hostname') : null,
    PORT: config.has('redis.port') ? config.get<number>('redis.port') : null,
    SOCKET: config.has('redis.socket') ? config.get<string>('redis.socket') : null,
    AUTH: config.has('redis.auth') ? config.get<string>('redis.auth') : null,
    DB: config.has('redis.db') ? config.get<number>('redis.db') : null
  },
  SMTP: {
    TRANSPORT: config.has('smtp.transport') ? config.get<string>('smtp.transport') : 'smtp',
    SENDMAIL: config.has('smtp.sendmail') ? config.get<string>('smtp.sendmail') : null,
    HOSTNAME: config.get<string>('smtp.hostname'),
    PORT: config.get<number>('smtp.port'),
    USERNAME: config.get<string>('smtp.username'),
    PASSWORD: config.get<string>('smtp.password'),
    TLS: config.get<boolean>('smtp.tls'),
    DISABLE_STARTTLS: config.get<boolean>('smtp.disable_starttls'),
    CA_FILE: config.get<string>('smtp.ca_file'),
    FROM_ADDRESS: config.get<string>('smtp.from_address')
  },
  EMAIL: {
    BODY: {
      SIGNATURE: config.get<string>('email.body.signature')
    },
    SUBJECT: {
      PREFIX: config.get<string>('email.subject.prefix') + ' '
    }
  },
  STORAGE: {
    TMP_DIR: buildPath(config.get<string>('storage.tmp')),
    AVATARS_DIR: buildPath(config.get<string>('storage.avatars')),
    LOG_DIR: buildPath(config.get<string>('storage.logs')),
    VIDEOS_DIR: buildPath(config.get<string>('storage.videos')),
    STREAMING_PLAYLISTS_DIR: buildPath(config.get<string>('storage.streaming_playlists')),
    REDUNDANCY_DIR: buildPath(config.get<string>('storage.redundancy')),
    THUMBNAILS_DIR: buildPath(config.get<string>('storage.thumbnails')),
    PREVIEWS_DIR: buildPath(config.get<string>('storage.previews')),
    CAPTIONS_DIR: buildPath(config.get<string>('storage.captions')),
    TORRENTS_DIR: buildPath(config.get<string>('storage.torrents')),
    CACHE_DIR: buildPath(config.get<string>('storage.cache')),
    PLUGINS_DIR: buildPath(config.get<string>('storage.plugins')),
    CLIENT_OVERRIDES_DIR: buildPath(config.get<string>('storage.client_overrides'))
  },
  WEBSERVER: {
    SCHEME: config.get<boolean>('webserver.https') === true ? 'https' : 'http',
    WS: config.get<boolean>('webserver.https') === true ? 'wss' : 'ws',
    HOSTNAME: config.get<string>('webserver.hostname'),
    PORT: config.get<number>('webserver.port')
  },
  RATES_LIMIT: {
    API: {
      WINDOW_MS: parseDurationToMs(config.get<string>('rates_limit.api.window')),
      MAX: config.get<number>('rates_limit.api.max')
    },
    SIGNUP: {
      WINDOW_MS: parseDurationToMs(config.get<string>('rates_limit.signup.window')),
      MAX: config.get<number>('rates_limit.signup.max')
    },
    LOGIN: {
      WINDOW_MS: parseDurationToMs(config.get<string>('rates_limit.login.window')),
      MAX: config.get<number>('rates_limit.login.max')
    },
    ASK_SEND_EMAIL: {
      WINDOW_MS: parseDurationToMs(config.get<string>('rates_limit.ask_send_email.window')),
      MAX: config.get<number>('rates_limit.ask_send_email.max')
    }
  },
  TRUST_PROXY: config.get<string[]>('trust_proxy'),
  LOG: {
    LEVEL: config.get<string>('log.level'),
    ROTATION: {
      ENABLED: config.get<boolean>('log.rotation.enabled'),
      MAX_FILE_SIZE: bytes.parse(config.get<string>('log.rotation.maxFileSize')),
      MAX_FILES: config.get<number>('log.rotation.maxFiles')
    },
    ANONYMIZE_IP: config.get<boolean>('log.anonymizeIP')
  },
  TRENDING: {
    VIDEOS: {
      INTERVAL_DAYS: config.get<number>('trending.videos.interval_days')
    }
  },
  REDUNDANCY: {
    VIDEOS: {
      CHECK_INTERVAL: parseDurationToMs(config.get<string>('redundancy.videos.check_interval')),
      STRATEGIES: buildVideosRedundancy(config.get<any[]>('redundancy.videos.strategies'))
    }
  },
  REMOTE_REDUNDANCY: {
    VIDEOS: {
      ACCEPT_FROM: config.get<VideoRedundancyConfigFilter>('remote_redundancy.videos.accept_from')
    }
  },
  CSP: {
    ENABLED: config.get<boolean>('csp.enabled'),
    REPORT_ONLY: config.get<boolean>('csp.report_only'),
    REPORT_URI: config.get<boolean>('csp.report_uri')
  },
  TRACKER: {
    ENABLED: config.get<boolean>('tracker.enabled'),
    PRIVATE: config.get<boolean>('tracker.private'),
    REJECT_TOO_MANY_ANNOUNCES: config.get<boolean>('tracker.reject_too_many_announces')
  },
  HISTORY: {
    VIDEOS: {
      MAX_AGE: parseDurationToMs(config.get('history.videos.max_age'))
    }
  },
  VIEWS: {
    VIDEOS: {
      REMOTE: {
        MAX_AGE: parseDurationToMs(config.get('views.videos.remote.max_age'))
      }
    }
  },
  PLUGINS: {
    INDEX: {
      ENABLED: config.get<boolean>('plugins.index.enabled'),
      CHECK_LATEST_VERSIONS_INTERVAL: parseDurationToMs(config.get<string>('plugins.index.check_latest_versions_interval')),
      URL: config.get<string>('plugins.index.url')
    }
  },
  FEDERATION: {
    VIDEOS: {
      FEDERATE_UNLISTED: config.get<boolean>('federation.videos.federate_unlisted')
    }
  },
  ADMIN: {
    get EMAIL () { return config.get<string>('admin.email') }
  },
  CONTACT_FORM: {
    get ENABLED () { return config.get<boolean>('contact_form.enabled') }
  },
  SIGNUP: {
    get ENABLED () { return config.get<boolean>('signup.enabled') },
    get LIMIT () { return config.get<number>('signup.limit') },
    get REQUIRES_EMAIL_VERIFICATION () { return config.get<boolean>('signup.requires_email_verification') },
    FILTERS: {
      CIDR: {
        get WHITELIST () { return config.get<string[]>('signup.filters.cidr.whitelist') },
        get BLACKLIST () { return config.get<string[]>('signup.filters.cidr.blacklist') }
      }
    }
  },
  USER: {
    get VIDEO_QUOTA () { return parseBytes(config.get<number>('user.video_quota')) },
    get VIDEO_QUOTA_DAILY () { return parseBytes(config.get<number>('user.video_quota_daily')) }
  },
  TRANSCODING: {
    get ENABLED () { return config.get<boolean>('transcoding.enabled') },
    get ALLOW_ADDITIONAL_EXTENSIONS () { return config.get<boolean>('transcoding.allow_additional_extensions') },
    get ALLOW_AUDIO_FILES () { return config.get<boolean>('transcoding.allow_audio_files') },
    get THREADS () { return config.get<number>('transcoding.threads') },
    RESOLUTIONS: {
      get '0p' () { return config.get<boolean>('transcoding.resolutions.0p') },
      get '240p' () { return config.get<boolean>('transcoding.resolutions.240p') },
      get '360p' () { return config.get<boolean>('transcoding.resolutions.360p') },
      get '480p' () { return config.get<boolean>('transcoding.resolutions.480p') },
      get '720p' () { return config.get<boolean>('transcoding.resolutions.720p') },
      get '1080p' () { return config.get<boolean>('transcoding.resolutions.1080p') },
      get '2160p' () { return config.get<boolean>('transcoding.resolutions.2160p') }
    },
    HLS: {
      get ENABLED () { return config.get<boolean>('transcoding.hls.enabled') }
    },
    WEBTORRENT: {
      get ENABLED () { return config.get<boolean>('transcoding.webtorrent.enabled') }
    }
  },
  IMPORT: {
    VIDEOS: {
      HTTP: {
        get ENABLED () { return config.get<boolean>('import.videos.http.enabled') },
        PROXY: {
          get ENABLED () { return config.get<boolean>('import.videos.http.proxy.enabled') },
          get URL () { return config.get<string>('import.videos.http.proxy.url') }
        }
      },
      TORRENT: {
        get ENABLED () { return config.get<boolean>('import.videos.torrent.enabled') }
      }
    }
  },
  AUTO_BLACKLIST: {
    VIDEOS: {
      OF_USERS: {
        get ENABLED () { return config.get<boolean>('auto_blacklist.videos.of_users.enabled') }
      }
    }
  },
  CACHE: {
    PREVIEWS: {
      get SIZE () { return config.get<number>('cache.previews.size') }
    },
    VIDEO_CAPTIONS: {
      get SIZE () { return config.get<number>('cache.captions.size') }
    }
  },
  INSTANCE: {
    get NAME () { return config.get<string>('instance.name') },
    get SHORT_DESCRIPTION () { return config.get<string>('instance.short_description') },
    get DESCRIPTION () { return config.get<string>('instance.description') },
    get TERMS () { return config.get<string>('instance.terms') },
    get CODE_OF_CONDUCT () { return config.get<string>('instance.code_of_conduct') },

    get CREATION_REASON () { return config.get<string>('instance.creation_reason') },

    get MODERATION_INFORMATION () { return config.get<string>('instance.moderation_information') },
    get ADMINISTRATOR () { return config.get<string>('instance.administrator') },
    get MAINTENANCE_LIFETIME () { return config.get<string>('instance.maintenance_lifetime') },
    get BUSINESS_MODEL () { return config.get<string>('instance.business_model') },
    get HARDWARE_INFORMATION () { return config.get<string>('instance.hardware_information') },

    get LANGUAGES () { return config.get<string[]>('instance.languages') || [] },
    get CATEGORIES () { return config.get<number[]>('instance.categories') || [] },

    get IS_NSFW () { return config.get<boolean>('instance.is_nsfw') },
    get DEFAULT_CLIENT_ROUTE () { return config.get<string>('instance.default_client_route') },
    get DEFAULT_NSFW_POLICY () { return config.get<NSFWPolicyType>('instance.default_nsfw_policy') },
    CUSTOMIZATIONS: {
      get JAVASCRIPT () { return config.get<string>('instance.customizations.javascript') },
      get CSS () { return config.get<string>('instance.customizations.css') }
    },
    get ROBOTS () { return config.get<string>('instance.robots') },
    get SECURITYTXT () { return config.get<string>('instance.securitytxt') },
    get SECURITYTXT_CONTACT () { return config.get<string>('admin.email') }
  },
  SERVICES: {
    TWITTER: {
      get USERNAME () { return config.get<string>('services.twitter.username') },
      get WHITELISTED () { return config.get<boolean>('services.twitter.whitelisted') }
    }
  },
  FOLLOWERS: {
    INSTANCE: {
      get ENABLED () { return config.get<boolean>('followers.instance.enabled') },
      get MANUAL_APPROVAL () { return config.get<boolean>('followers.instance.manual_approval') }
    }
  },
  FOLLOWINGS: {
    INSTANCE: {
      AUTO_FOLLOW_BACK: {
        get ENABLED () {
          return config.get<boolean>('followings.instance.auto_follow_back.enabled')
        }
      },
      AUTO_FOLLOW_INDEX: {
        get ENABLED () {
          return config.get<boolean>('followings.instance.auto_follow_index.enabled')
        },
        get INDEX_URL () {
          return config.get<string>('followings.instance.auto_follow_index.index_url')
        }
      }
    }
  },
  THEME: {
    get DEFAULT () { return config.get<string>('theme.default') }
  },
  BROADCAST_MESSAGE: {
    get ENABLED () { return config.get<boolean>('broadcast_message.enabled') },
    get MESSAGE () { return config.get<string>('broadcast_message.message') },
    get LEVEL () { return config.get<BroadcastMessageLevel>('broadcast_message.level') },
    get DISMISSABLE () { return config.get<boolean>('broadcast_message.dismissable') }
  },
  SEARCH: {
    REMOTE_URI: {
      USERS: config.get<boolean>('search.remote_uri.users'),
      ANONYMOUS: config.get<boolean>('search.remote_uri.anonymous')
    },
    SEARCH_INDEX: {
      get ENABLED () { return config.get<boolean>('search.search_index.enabled') },
      get URL () { return config.get<string>('search.search_index.url') },
      get DISABLE_LOCAL_SEARCH () { return config.get<boolean>('search.search_index.disable_local_search') },
      get IS_DEFAULT_SEARCH () { return config.get<boolean>('search.search_index.is_default_search') }
    }
  }
}

function registerConfigChangedHandler (fun: Function) {
  configChangedHandlers.push(fun)
}

function isEmailEnabled () {
  return !!CONFIG.SMTP.HOSTNAME && !!CONFIG.SMTP.PORT
}

// ---------------------------------------------------------------------------

export {
  CONFIG,
  registerConfigChangedHandler,
  isEmailEnabled
}

// ---------------------------------------------------------------------------

function getLocalConfigFilePath () {
  const configSources = config.util.getConfigSources()
  if (configSources.length === 0) throw new Error('Invalid config source.')

  let filename = 'local'
  if (process.env.NODE_ENV) filename += `-${process.env.NODE_ENV}`
  if (process.env.NODE_APP_INSTANCE) filename += `-${process.env.NODE_APP_INSTANCE}`

  return join(dirname(configSources[0].name), filename + '.json')
}

function buildVideosRedundancy (objs: any[]): VideosRedundancyStrategy[] {
  if (!objs) return []

  if (!Array.isArray(objs)) return objs

  return objs.map(obj => {
    return Object.assign({}, obj, {
      minLifetime: parseDurationToMs(obj.min_lifetime),
      size: bytes.parse(obj.size),
      minViews: obj.min_views
    })
  })
}

export function reloadConfig () {

  function directory () {
    if (process.env.NODE_CONFIG_DIR) {
      return process.env.NODE_CONFIG_DIR
    }

    return join(root(), 'config')
  }

  function purge () {
    for (const fileName in require.cache) {
      if (fileName.includes(directory()) === false) {
        continue
      }

      delete require.cache[fileName]
    }

    delete require.cache[require.resolve('config')]
  }

  purge()

  config = require('config')

  for (const configChangedHandler of configChangedHandlers) {
    configChangedHandler()
  }
}
