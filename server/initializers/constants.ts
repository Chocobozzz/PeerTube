import { IConfig } from 'config'
import { dirname, join } from 'path'
import { JobType, VideoRateType, VideoState } from '../../shared/models'
import { ActivityPubActorType } from '../../shared/models/activitypub'
import { FollowState } from '../../shared/models/actors'
import { VideoPrivacy, VideoAbuseState, VideoImportState } from '../../shared/models/videos'
// Do not use barrels, remain constants as independent as possible
import { buildPath, isTestInstance, root, sanitizeHost, sanitizeUrl } from '../helpers/core-utils'
import { NSFWPolicyType } from '../../shared/models/videos/nsfw-policy.type'
import { invert } from 'lodash'

// Use a variable to reload the configuration if we need
let config: IConfig = require('config')

// ---------------------------------------------------------------------------

const LAST_MIGRATION_VERSION = 255

// ---------------------------------------------------------------------------

// API version
const API_VERSION = 'v1'

const PAGINATION = {
  COUNT: {
    DEFAULT: 15,
    MAX: 100
  }
}

// Sortable columns per schema
const SORTABLE_COLUMNS = {
  USERS: [ 'id', 'username', 'createdAt' ],
  ACCOUNTS: [ 'createdAt' ],
  JOBS: [ 'createdAt' ],
  VIDEO_ABUSES: [ 'id', 'createdAt', 'state' ],
  VIDEO_CHANNELS: [ 'id', 'name', 'updatedAt', 'createdAt' ],
  VIDEOS: [ 'name', 'duration', 'createdAt', 'publishedAt', 'views', 'likes' ],
  VIDEO_IMPORTS: [ 'createdAt' ],
  VIDEO_COMMENT_THREADS: [ 'createdAt' ],
  BLACKLISTS: [ 'id', 'name', 'duration', 'views', 'likes', 'dislikes', 'uuid', 'createdAt' ],
  FOLLOWERS: [ 'createdAt' ],
  FOLLOWING: [ 'createdAt' ],

  VIDEOS_SEARCH: [ 'match', 'name', 'duration', 'createdAt', 'publishedAt', 'views', 'likes' ]
}

const OAUTH_LIFETIME = {
  ACCESS_TOKEN: 3600 * 24, // 1 day, for upload
  REFRESH_TOKEN: 1209600 // 2 weeks
}

const ROUTE_CACHE_LIFETIME = {
  FEEDS: '15 minutes',
  ROBOTS: '2 hours',
  NODEINFO: '10 minutes',
  DNT_POLICY: '1 week',
  ACTIVITY_PUB: {
    VIDEOS: '1 second' // 1 second, cache concurrent requests after a broadcast for example
  }
}

// ---------------------------------------------------------------------------

// Number of points we add/remove after a successful/bad request
const ACTOR_FOLLOW_SCORE = {
  PENALTY: -10,
  BONUS: 10,
  BASE: 1000,
  MAX: 10000
}

const FOLLOW_STATES: { [ id: string ]: FollowState } = {
  PENDING: 'pending',
  ACCEPTED: 'accepted'
}

const REMOTE_SCHEME = {
  HTTP: 'https',
  WS: 'wss'
}

const JOB_ATTEMPTS: { [ id in JobType ]: number } = {
  'activitypub-http-broadcast': 5,
  'activitypub-http-unicast': 5,
  'activitypub-http-fetcher': 5,
  'activitypub-follow': 5,
  'video-file-import': 1,
  'video-file': 1,
  'video-import': 1,
  'email': 5
}
const JOB_CONCURRENCY: { [ id in JobType ]: number } = {
  'activitypub-http-broadcast': 1,
  'activitypub-http-unicast': 5,
  'activitypub-http-fetcher': 1,
  'activitypub-follow': 3,
  'video-file-import': 1,
  'video-file': 1,
  'video-import': 1,
  'email': 5
}
const JOB_TTL: { [ id in JobType ]: number } = {
  'activitypub-http-broadcast': 60000 * 10, // 10 minutes
  'activitypub-http-unicast': 60000 * 10, // 10 minutes
  'activitypub-http-fetcher': 60000 * 10, // 10 minutes
  'activitypub-follow': 60000 * 10, // 10 minutes
  'video-file-import': 1000 * 3600, // 1 hour
  'video-file': 1000 * 3600 * 48, // 2 days, transcoding could be long
  'video-import': 1000 * 3600 * 5, // 5 hours
  'email': 60000 * 10 // 10 minutes
}
const BROADCAST_CONCURRENCY = 10 // How many requests in parallel we do in activitypub-http-broadcast job
const JOB_REQUEST_TIMEOUT = 3000 // 3 seconds
const JOB_COMPLETED_LIFETIME = 60000 * 60 * 24 * 2 // 2 days

// 1 hour
let SCHEDULER_INTERVALS_MS = {
  badActorFollow: 60000 * 60, // 1 hour
  removeOldJobs: 60000 * 60, // 1 hour
  updateVideos: 60000, // 1 minute
  youtubeDLUpdate: 60000 * 60 * 24 // 1 day
}

// ---------------------------------------------------------------------------

const CONFIG = {
  CUSTOM_FILE: getLocalConfigFilePath(),
  LISTEN: {
    PORT: config.get<number>('listen.port'),
    HOSTNAME: config.get<string>('listen.hostname')
  },
  DATABASE: {
    DBNAME: 'peertube' + config.get<string>('database.suffix'),
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
    HOSTNAME: config.get<string>('smtp.hostname'),
    PORT: config.get<number>('smtp.port'),
    USERNAME: config.get<string>('smtp.username'),
    PASSWORD: config.get<string>('smtp.password'),
    TLS: config.get<boolean>('smtp.tls'),
    DISABLE_STARTTLS: config.get<boolean>('smtp.disable_starttls'),
    CA_FILE: config.get<string>('smtp.ca_file'),
    FROM_ADDRESS: config.get<string>('smtp.from_address')
  },
  STORAGE: {
    AVATARS_DIR: buildPath(config.get<string>('storage.avatars')),
    LOG_DIR: buildPath(config.get<string>('storage.logs')),
    VIDEOS_DIR: buildPath(config.get<string>('storage.videos')),
    THUMBNAILS_DIR: buildPath(config.get<string>('storage.thumbnails')),
    PREVIEWS_DIR: buildPath(config.get<string>('storage.previews')),
    CAPTIONS_DIR: buildPath(config.get<string>('storage.captions')),
    TORRENTS_DIR: buildPath(config.get<string>('storage.torrents')),
    CACHE_DIR: buildPath(config.get<string>('storage.cache'))
  },
  WEBSERVER: {
    SCHEME: config.get<boolean>('webserver.https') === true ? 'https' : 'http',
    WS: config.get<boolean>('webserver.https') === true ? 'wss' : 'ws',
    HOSTNAME: config.get<string>('webserver.hostname'),
    PORT: config.get<number>('webserver.port'),
    URL: '',
    HOST: ''
  },
  TRUST_PROXY: config.get<string[]>('trust_proxy'),
  LOG: {
    LEVEL: config.get<string>('log.level')
  },
  ADMIN: {
    get EMAIL () { return config.get<string>('admin.email') }
  },
  SIGNUP: {
    get ENABLED () { return config.get<boolean>('signup.enabled') },
    get LIMIT () { return config.get<number>('signup.limit') },
    FILTERS: {
      CIDR: {
        get WHITELIST () { return config.get<string[]>('signup.filters.cidr.whitelist') },
        get BLACKLIST () { return config.get<string[]>('signup.filters.cidr.blacklist') }
      }
    }
  },
  USER: {
    get VIDEO_QUOTA () { return config.get<number>('user.video_quota') }
  },
  TRANSCODING: {
    get ENABLED () { return config.get<boolean>('transcoding.enabled') },
    get THREADS () { return config.get<number>('transcoding.threads') },
    RESOLUTIONS: {
      get '240p' () { return config.get<boolean>('transcoding.resolutions.240p') },
      get '360p' () { return config.get<boolean>('transcoding.resolutions.360p') },
      get '480p' () { return config.get<boolean>('transcoding.resolutions.480p') },
      get '720p' () { return config.get<boolean>('transcoding.resolutions.720p') },
      get '1080p' () { return config.get<boolean>('transcoding.resolutions.1080p') }
    }
  },
  IMPORT: {
    VIDEOS: {
      HTTP: {
        get ENABLED () { return config.get<boolean>('import.videos.http.enabled') }
      },
      TORRENT: {
        get ENABLED () { return config.get<boolean>('import.videos.torrent.enabled') }
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
    get DEFAULT_CLIENT_ROUTE () { return config.get<string>('instance.default_client_route') },
    get DEFAULT_NSFW_POLICY () { return config.get<NSFWPolicyType>('instance.default_nsfw_policy') },
    CUSTOMIZATIONS: {
      get JAVASCRIPT () { return config.get<string>('instance.customizations.javascript') },
      get CSS () { return config.get<string>('instance.customizations.css') }
    },
    get ROBOTS () { return config.get<string>('instance.robots') }
  },
  SERVICES: {
    TWITTER: {
      get USERNAME () { return config.get<string>('services.twitter.username') },
      get WHITELISTED () { return config.get<boolean>('services.twitter.whitelisted') }
    }
  }
}

// ---------------------------------------------------------------------------

const CONSTRAINTS_FIELDS = {
  USERS: {
    NAME: { min: 3, max: 120 }, // Length
    DESCRIPTION: { min: 3, max: 250 }, // Length
    USERNAME: { min: 3, max: 20 }, // Length
    PASSWORD: { min: 6, max: 255 }, // Length
    VIDEO_QUOTA: { min: -1 },
    BLOCKED_REASON: { min: 3, max: 250 } // Length
  },
  VIDEO_ABUSES: {
    REASON: { min: 2, max: 300 }, // Length
    MODERATION_COMMENT: { min: 2, max: 300 } // Length
  },
  VIDEO_BLACKLIST: {
    REASON: { min: 2, max: 300 } // Length
  },
  VIDEO_CHANNELS: {
    NAME: { min: 3, max: 120 }, // Length
    DESCRIPTION: { min: 3, max: 500 }, // Length
    SUPPORT: { min: 3, max: 500 }, // Length
    URL: { min: 3, max: 2000 } // Length
  },
  VIDEO_CAPTIONS: {
    CAPTION_FILE: {
      EXTNAME: [ '.vtt', '.srt' ],
      FILE_SIZE: {
        max: 2 * 1024 * 1024 // 2MB
      }
    }
  },
  VIDEO_IMPORTS: {
    URL: { min: 3, max: 2000 }, // Length
    TORRENT_NAME: { min: 3, max: 255 }, // Length
    TORRENT_FILE: {
      EXTNAME: [ '.torrent' ],
      FILE_SIZE: {
        max: 1024 * 200 // 200 KB
      }
    }
  },
  VIDEOS: {
    NAME: { min: 3, max: 120 }, // Length
    LANGUAGE: { min: 1, max: 10 }, // Length
    TRUNCATED_DESCRIPTION: { min: 3, max: 250 }, // Length
    DESCRIPTION: { min: 3, max: 10000 }, // Length
    SUPPORT: { min: 3, max: 500 }, // Length
    IMAGE: {
      EXTNAME: [ '.jpg', '.jpeg' ],
      FILE_SIZE: {
        max: 2 * 1024 * 1024 // 2MB
      }
    },
    EXTNAME: [ '.mp4', '.ogv', '.webm' ],
    INFO_HASH: { min: 40, max: 40 }, // Length, info hash is 20 bytes length but we represent it in hexadecimal so 20 * 2
    DURATION: { min: 0 }, // Number
    TAGS: { min: 0, max: 5 }, // Number of total tags
    TAG: { min: 2, max: 30 }, // Length
    THUMBNAIL: { min: 2, max: 30 },
    THUMBNAIL_DATA: { min: 0, max: 20000 }, // Bytes
    VIEWS: { min: 0 },
    LIKES: { min: 0 },
    DISLIKES: { min: 0 },
    FILE_SIZE: { min: 10 },
    URL: { min: 3, max: 2000 } // Length
  },
  ACTORS: {
    PUBLIC_KEY: { min: 10, max: 5000 }, // Length
    PRIVATE_KEY: { min: 10, max: 5000 }, // Length
    URL: { min: 3, max: 2000 }, // Length
    AVATAR: {
      EXTNAME: [ '.png', '.jpeg', '.jpg' ],
      FILE_SIZE: {
        max: 2 * 1024 * 1024 // 2MB
      }
    }
  },
  VIDEO_EVENTS: {
    COUNT: { min: 0 }
  },
  VIDEO_COMMENTS: {
    TEXT: { min: 1, max: 3000 }, // Length
    URL: { min: 3, max: 2000 } // Length
  },
  VIDEO_SHARE: {
    URL: { min: 3, max: 2000 } // Length
  }
}

const RATES_LIMIT = {
  LOGIN: {
    WINDOW_MS: 5 * 60 * 1000, // 5 minutes
    MAX: 15 // 15 attempts
  }
}

let VIDEO_VIEW_LIFETIME = 60000 * 60 // 1 hour
const VIDEO_TRANSCODING_FPS = {
  MIN: 10,
  AVERAGE: 30,
  MAX: 60,
  KEEP_ORIGIN_FPS_RESOLUTION_MIN: 720 // We keep the original FPS on high resolutions (720 minimum)
}

const VIDEO_RATE_TYPES: { [ id: string ]: VideoRateType } = {
  LIKE: 'like',
  DISLIKE: 'dislike'
}

const FFMPEG_NICE: { [ id: string ]: number } = {
  THUMBNAIL: 2, // 2 just for don't blocking servers
  TRANSCODING: 15
}

const VIDEO_CATEGORIES = {
  1: 'Music',
  2: 'Films',
  3: 'Vehicles',
  4: 'Art',
  5: 'Sports',
  6: 'Travels',
  7: 'Gaming',
  8: 'People',
  9: 'Comedy',
  10: 'Entertainment',
  11: 'News',
  12: 'How To',
  13: 'Education',
  14: 'Activism',
  15: 'Science & Technology',
  16: 'Animals',
  17: 'Kids',
  18: 'Food'
}

// See https://creativecommons.org/licenses/?lang=en
const VIDEO_LICENCES = {
  1: 'Attribution',
  2: 'Attribution - Share Alike',
  3: 'Attribution - No Derivatives',
  4: 'Attribution - Non Commercial',
  5: 'Attribution - Non Commercial - Share Alike',
  6: 'Attribution - Non Commercial - No Derivatives',
  7: 'Public Domain Dedication'
}

const VIDEO_LANGUAGES = buildLanguages()

const VIDEO_PRIVACIES = {
  [VideoPrivacy.PUBLIC]: 'Public',
  [VideoPrivacy.UNLISTED]: 'Unlisted',
  [VideoPrivacy.PRIVATE]: 'Private'
}

const VIDEO_STATES = {
  [VideoState.PUBLISHED]: 'Published',
  [VideoState.TO_TRANSCODE]: 'To transcode',
  [VideoState.TO_IMPORT]: 'To import'
}

const VIDEO_IMPORT_STATES = {
  [VideoImportState.FAILED]: 'Failed',
  [VideoImportState.PENDING]: 'Pending',
  [VideoImportState.SUCCESS]: 'Success'
}

const VIDEO_ABUSE_STATES = {
  [VideoAbuseState.PENDING]: 'Pending',
  [VideoAbuseState.REJECTED]: 'Rejected',
  [VideoAbuseState.ACCEPTED]: 'Accepted'
}

const VIDEO_MIMETYPE_EXT = {
  'video/webm': '.webm',
  'video/ogg': '.ogv',
  'video/mp4': '.mp4'
}
const VIDEO_EXT_MIMETYPE = invert(VIDEO_MIMETYPE_EXT)

const IMAGE_MIMETYPE_EXT = {
  'image/png': '.png',
  'image/jpg': '.jpg',
  'image/jpeg': '.jpg'
}

const VIDEO_CAPTIONS_MIMETYPE_EXT = {
  'text/vtt': '.vtt',
  'application/x-subrip': '.srt'
}

const TORRENT_MIMETYPE_EXT = {
  'application/x-bittorrent': '.torrent'
}

// ---------------------------------------------------------------------------

const SERVER_ACTOR_NAME = 'peertube'

const ACTIVITY_PUB = {
  POTENTIAL_ACCEPT_HEADERS: [
    'application/activity+json',
    'application/ld+json',
    'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
  ],
  ACCEPT_HEADER: 'application/activity+json, application/ld+json',
  PUBLIC: 'https://www.w3.org/ns/activitystreams#Public',
  COLLECTION_ITEMS_PER_PAGE: 10,
  FETCH_PAGE_LIMIT: 100,
  URL_MIME_TYPES: {
    VIDEO: Object.keys(VIDEO_MIMETYPE_EXT),
    TORRENT: [ 'application/x-bittorrent' ],
    MAGNET: [ 'application/x-bittorrent;x-scheme-handler/magnet' ]
  },
  MAX_RECURSION_COMMENTS: 100,
  ACTOR_REFRESH_INTERVAL: 3600 * 24 * 1000 // 1 day
}

const ACTIVITY_PUB_ACTOR_TYPES: { [ id: string ]: ActivityPubActorType } = {
  GROUP: 'Group',
  PERSON: 'Person',
  APPLICATION: 'Application'
}

// ---------------------------------------------------------------------------

const PRIVATE_RSA_KEY_SIZE = 2048

// Password encryption
const BCRYPT_SALT_SIZE = 10

const USER_PASSWORD_RESET_LIFETIME = 60000 * 5 // 5 minutes

const NSFW_POLICY_TYPES: { [ id: string]: NSFWPolicyType } = {
  DO_NOT_LIST: 'do_not_list',
  BLUR: 'blur',
  DISPLAY: 'display'
}

// ---------------------------------------------------------------------------

// Express static paths (router)
const STATIC_PATHS = {
  PREVIEWS: '/static/previews/',
  THUMBNAILS: '/static/thumbnails/',
  TORRENTS: '/static/torrents/',
  WEBSEED: '/static/webseed/',
  AVATARS: '/static/avatars/',
  VIDEO_CAPTIONS: '/static/video-captions/'
}
const STATIC_DOWNLOAD_PATHS = {
  TORRENTS: '/download/torrents/',
  VIDEOS: '/download/videos/'
}

// Cache control
let STATIC_MAX_AGE = '2h'

// Videos thumbnail size
const THUMBNAILS_SIZE = {
  width: 200,
  height: 110
}
const PREVIEWS_SIZE = {
  width: 560,
  height: 315
}
const AVATARS_SIZE = {
  width: 120,
  height: 120
}

const EMBED_SIZE = {
  width: 560,
  height: 315
}

// Sub folders of cache directory
const CACHE = {
  PREVIEWS: {
    DIRECTORY: join(CONFIG.STORAGE.CACHE_DIR, 'previews'),
    MAX_AGE: 1000 * 3600 * 3 // 3 hours
  },
  VIDEO_CAPTIONS: {
    DIRECTORY: join(CONFIG.STORAGE.CACHE_DIR, 'video-captions'),
    MAX_AGE: 1000 * 3600 * 3 // 3 hours
  }
}

const ACCEPT_HEADERS = [ 'html', 'application/json' ].concat(ACTIVITY_PUB.POTENTIAL_ACCEPT_HEADERS)

// ---------------------------------------------------------------------------

const CUSTOM_HTML_TAG_COMMENTS = {
  TITLE: '<!-- title tag -->',
  DESCRIPTION: '<!-- description tag -->',
  CUSTOM_CSS: '<!-- custom css tag -->',
  OPENGRAPH_AND_OEMBED: '<!-- open graph and oembed tags -->'
}

// ---------------------------------------------------------------------------

const FEEDS = {
  COUNT: 20
}

// ---------------------------------------------------------------------------

const TRACKER_RATE_LIMITS = {
  INTERVAL: 60000 * 5, // 5 minutes
  ANNOUNCES_PER_IP_PER_INFOHASH: 15, // maximum announces per torrent in the interval
  ANNOUNCES_PER_IP: 30 // maximum announces for all our torrents in the interval
}

// ---------------------------------------------------------------------------

// Special constants for a test instance
if (isTestInstance() === true) {
  ACTOR_FOLLOW_SCORE.BASE = 20

  REMOTE_SCHEME.HTTP = 'http'
  REMOTE_SCHEME.WS = 'ws'

  STATIC_MAX_AGE = '0'

  ACTIVITY_PUB.COLLECTION_ITEMS_PER_PAGE = 2
  ACTIVITY_PUB.ACTOR_REFRESH_INTERVAL = 10 * 1000 // 10 seconds

  CONSTRAINTS_FIELDS.ACTORS.AVATAR.FILE_SIZE.max = 100 * 1024 // 100KB

  SCHEDULER_INTERVALS_MS.badActorFollow = 10000
  SCHEDULER_INTERVALS_MS.removeOldJobs = 10000
  SCHEDULER_INTERVALS_MS.updateVideos = 5000

  VIDEO_VIEW_LIFETIME = 1000 // 1 second

  JOB_ATTEMPTS['email'] = 1

  CACHE.VIDEO_CAPTIONS.MAX_AGE = 3000
}

updateWebserverConfig()

// ---------------------------------------------------------------------------

export {
  API_VERSION,
  VIDEO_CAPTIONS_MIMETYPE_EXT,
  AVATARS_SIZE,
  ACCEPT_HEADERS,
  BCRYPT_SALT_SIZE,
  TRACKER_RATE_LIMITS,
  CACHE,
  CONFIG,
  CONSTRAINTS_FIELDS,
  EMBED_SIZE,
  JOB_CONCURRENCY,
  JOB_ATTEMPTS,
  LAST_MIGRATION_VERSION,
  OAUTH_LIFETIME,
  CUSTOM_HTML_TAG_COMMENTS,
  BROADCAST_CONCURRENCY,
  PAGINATION,
  ACTOR_FOLLOW_SCORE,
  PREVIEWS_SIZE,
  REMOTE_SCHEME,
  FOLLOW_STATES,
  SERVER_ACTOR_NAME,
  PRIVATE_RSA_KEY_SIZE,
  ROUTE_CACHE_LIFETIME,
  SORTABLE_COLUMNS,
  FEEDS,
  JOB_TTL,
  NSFW_POLICY_TYPES,
  TORRENT_MIMETYPE_EXT,
  STATIC_MAX_AGE,
  STATIC_PATHS,
  ACTIVITY_PUB,
  ACTIVITY_PUB_ACTOR_TYPES,
  THUMBNAILS_SIZE,
  VIDEO_CATEGORIES,
  VIDEO_LANGUAGES,
  VIDEO_PRIVACIES,
  VIDEO_LICENCES,
  VIDEO_STATES,
  VIDEO_RATE_TYPES,
  VIDEO_MIMETYPE_EXT,
  VIDEO_TRANSCODING_FPS,
  FFMPEG_NICE,
  VIDEO_ABUSE_STATES,
  JOB_REQUEST_TIMEOUT,
  USER_PASSWORD_RESET_LIFETIME,
  IMAGE_MIMETYPE_EXT,
  SCHEDULER_INTERVALS_MS,
  STATIC_DOWNLOAD_PATHS,
  RATES_LIMIT,
  VIDEO_EXT_MIMETYPE,
  JOB_COMPLETED_LIFETIME,
  VIDEO_IMPORT_STATES,
  VIDEO_VIEW_LIFETIME,
  buildLanguages
}

// ---------------------------------------------------------------------------

function getLocalConfigFilePath () {
  const configSources = config.util.getConfigSources()
  if (configSources.length === 0) throw new Error('Invalid config source.')

  let filename = 'local'
  if (process.env.NODE_ENV) filename += `-${process.env.NODE_ENV}`
  if (process.env.NODE_APP_INSTANCE) filename += `-${process.env.NODE_APP_INSTANCE}`

  return join(dirname(configSources[ 0 ].name), filename + '.json')
}

function updateWebserverConfig () {
  CONFIG.WEBSERVER.URL = sanitizeUrl(CONFIG.WEBSERVER.SCHEME + '://' + CONFIG.WEBSERVER.HOSTNAME + ':' + CONFIG.WEBSERVER.PORT)
  CONFIG.WEBSERVER.HOST = sanitizeHost(CONFIG.WEBSERVER.HOSTNAME + ':' + CONFIG.WEBSERVER.PORT, REMOTE_SCHEME.HTTP)
}

function buildLanguages () {
  const iso639 = require('iso-639-3')

  const languages: { [ id: string ]: string } = {}

  const additionalLanguages = {
    'sgn': true, // Sign languages (macro language)
    'ase': true, // American sign language
    'sdl': true, // Arabian sign language
    'bfi': true, // British sign language
    'bzs': true, // Brazilian sign language
    'csl': true, // Chinese sign language
    'cse': true, // Czech sign language
    'dsl': true, // Danish sign language
    'fsl': true, // French sign language
    'gsg': true, // German sign language
    'pks': true, // Pakistan sign language
    'jsl': true, // Japanese sign language
    'sfs': true, // South African sign language
    'swl': true, // Swedish sign language
    'rsl': true, // Russian sign language: true

    'epo': true, // Esperanto
    'tlh': true, // Klingon
    'jbo': true, // Lojban
    'avk': true // Kotava
  }

  // Only add ISO639-1 languages and some sign languages (ISO639-3)
  iso639
    .filter(l => {
      return (l.iso6391 !== null && l.type === 'living') ||
        additionalLanguages[l.iso6393] === true
    })
    .forEach(l => languages[l.iso6391 || l.iso6393] = l.name)

  return languages
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
      if (-1 === fileName.indexOf(directory())) {
        continue
      }

      delete require.cache[fileName]
    }

    delete require.cache[require.resolve('config')]
  }

  purge()

  config = require('config')

  updateWebserverConfig()
}
