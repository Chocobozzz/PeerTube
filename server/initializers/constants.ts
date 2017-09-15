import * as config from 'config'
import { join } from 'path'

// Do not use barrels, remain constants as independent as possible
import { root, isTestInstance } from '../helpers/core-utils'

import {
  UserRole,
  VideoRateType,
  RequestEndpoint,
  RequestVideoEventType,
  RequestVideoQaduType,
  JobState
} from '../../shared/models'

// ---------------------------------------------------------------------------

const LAST_MIGRATION_VERSION = 70

// ---------------------------------------------------------------------------

// API version
const API_VERSION = 'v1'

// Number of results by default for the pagination
const PAGINATION_COUNT_DEFAULT = 15

// Sortable columns per schema
const SEARCHABLE_COLUMNS = {
  VIDEOS: [ 'name', 'magnetUri', 'host', 'author', 'tags' ]
}

// Sortable columns per schema
const SORTABLE_COLUMNS = {
  USERS: [ 'id', 'username', 'createdAt' ],
  VIDEO_ABUSES: [ 'id', 'createdAt' ],
  VIDEOS: [ 'name', 'duration', 'createdAt', 'views', 'likes' ],
  BLACKLISTS: [ 'id', 'name', 'duration', 'views', 'likes', 'dislikes', 'uuid', 'createdAt' ]
}

const OAUTH_LIFETIME = {
  ACCESS_TOKEN: 3600 * 4, // 4 hours
  REFRESH_TOKEN: 1209600 // 2 weeks
}

// ---------------------------------------------------------------------------

const CONFIG = {
  LISTEN: {
    PORT: config.get<number>('listen.port')
  },
  DATABASE: {
    DBNAME: 'peertube' + config.get<string>('database.suffix'),
    HOSTNAME: config.get<string>('database.hostname'),
    PORT: config.get<number>('database.port'),
    USERNAME: config.get<string>('database.username'),
    PASSWORD: config.get<string>('database.password')
  },
  STORAGE: {
    CERT_DIR: join(root(), config.get<string>('storage.certs')),
    LOG_DIR: join(root(), config.get<string>('storage.logs')),
    VIDEOS_DIR: join(root(), config.get<string>('storage.videos')),
    THUMBNAILS_DIR: join(root(), config.get<string>('storage.thumbnails')),
    PREVIEWS_DIR: join(root(), config.get<string>('storage.previews')),
    TORRENTS_DIR: join(root(), config.get<string>('storage.torrents')),
    CACHE_DIR: join(root(), config.get<string>('storage.cache'))
  },
  WEBSERVER: {
    SCHEME: config.get<boolean>('webserver.https') === true ? 'https' : 'http',
    WS: config.get<boolean>('webserver.https') === true ? 'wss' : 'ws',
    HOSTNAME: config.get<string>('webserver.hostname'),
    PORT: config.get<number>('webserver.port'),
    URL: '',
    HOST: ''
  },
  ADMIN: {
    EMAIL: config.get<string>('admin.email')
  },
  SIGNUP: {
    ENABLED: config.get<boolean>('signup.enabled'),
    LIMIT: config.get<number>('signup.limit')
  },
  USER: {
    VIDEO_QUOTA: config.get<number>('user.video_quota')
  },
  TRANSCODING: {
    ENABLED: config.get<boolean>('transcoding.enabled'),
    THREADS: config.get<number>('transcoding.threads')
  },
  CACHE: {
    PREVIEWS: {
      SIZE: config.get<number>('cache.previews.size')
    }
  }
}
CONFIG.WEBSERVER.URL = CONFIG.WEBSERVER.SCHEME + '://' + CONFIG.WEBSERVER.HOSTNAME + ':' + CONFIG.WEBSERVER.PORT
CONFIG.WEBSERVER.HOST = CONFIG.WEBSERVER.HOSTNAME + ':' + CONFIG.WEBSERVER.PORT

// ---------------------------------------------------------------------------

const CONSTRAINTS_FIELDS = {
  USERS: {
    USERNAME: { min: 3, max: 20 }, // Length
    PASSWORD: { min: 6, max: 255 }, // Length
    VIDEO_QUOTA: { min: -1 }
  },
  VIDEO_ABUSES: {
    REASON: { min: 2, max: 300 } // Length
  },
  VIDEOS: {
    NAME: { min: 3, max: 50 }, // Length
    DESCRIPTION: { min: 3, max: 250 }, // Length
    EXTNAME: [ '.mp4', '.ogv', '.webm' ],
    INFO_HASH: { min: 40, max: 40 }, // Length, info hash is 20 bytes length but we represent it in hexadecimal so 20 * 2
    DURATION: { min: 1, max: 7200 }, // Number
    TAGS: { min: 0, max: 3 }, // Number of total tags
    TAG: { min: 2, max: 10 }, // Length
    THUMBNAIL: { min: 2, max: 30 },
    THUMBNAIL_DATA: { min: 0, max: 20000 }, // Bytes
    VIEWS: { min: 0 },
    LIKES: { min: 0 },
    DISLIKES: { min: 0 },
    FILE_SIZE: { min: 10, max: 1024 * 1024 * 1024 * 3 /* 3Go */ }
  },
  VIDEO_EVENTS: {
    COUNT: { min: 0 }
  }
}

const VIDEO_RATE_TYPES: { [ id: string ]: VideoRateType } = {
  LIKE: 'like',
  DISLIKE: 'dislike'
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
  12: 'Howto',
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

// See https://en.wikipedia.org/wiki/List_of_languages_by_number_of_native_speakers#Nationalencyklopedin
const VIDEO_LANGUAGES = {
  1: 'English',
  2: 'Spanish',
  3: 'Mandarin',
  4: 'Hindi',
  5: 'Arabic',
  6: 'Portuguese',
  7: 'Bengali',
  8: 'Russian',
  9: 'Japanese',
  10: 'Punjabi',
  11: 'German',
  12: 'Korean',
  13: 'French',
  14: 'Italien'
}

const VIDEO_FILE_RESOLUTIONS = {
  0: 'original',
  1: '360p',
  2: '480p',
  3: '720p',
  4: '1080p'
}

// ---------------------------------------------------------------------------

// Score a pod has when we create it as a friend
const FRIEND_SCORE = {
  BASE: 100,
  MAX: 1000
}

// ---------------------------------------------------------------------------

// Number of points we add/remove from a friend after a successful/bad request
const PODS_SCORE = {
  MALUS: -10,
  BONUS: 10
}

// Time to wait between requests to the friends (10 min)
let REQUESTS_INTERVAL = 600000

// Number of requests in parallel we can make
const REQUESTS_IN_PARALLEL = 10

// To how many pods we send requests
const REQUESTS_LIMIT_PODS = 10
// How many requests we send to a pod per interval
const REQUESTS_LIMIT_PER_POD = 5

const REQUESTS_VIDEO_QADU_LIMIT_PODS = 10
// The QADU requests are not big
const REQUESTS_VIDEO_QADU_LIMIT_PER_POD = 50

const REQUESTS_VIDEO_EVENT_LIMIT_PODS = 10
// The EVENTS requests are not big
const REQUESTS_VIDEO_EVENT_LIMIT_PER_POD = 50

// Number of requests to retry for replay requests module
const RETRY_REQUESTS = 5

const REQUEST_ENDPOINTS: { [ id: string ]: RequestEndpoint } = {
  VIDEOS: 'videos'
}

const REQUEST_ENDPOINT_ACTIONS: { [ id: string ]: any } = {}
REQUEST_ENDPOINT_ACTIONS[REQUEST_ENDPOINTS.VIDEOS] = {
  ADD: 'add',
  UPDATE: 'update',
  REMOVE: 'remove',
  REPORT_ABUSE: 'report-abuse'
}

const REQUEST_VIDEO_QADU_ENDPOINT = 'videos/qadu'
const REQUEST_VIDEO_EVENT_ENDPOINT = 'videos/events'

const REQUEST_VIDEO_QADU_TYPES: { [ id: string ]: RequestVideoQaduType } = {
  LIKES: 'likes',
  DISLIKES: 'dislikes',
  VIEWS: 'views'
}

const REQUEST_VIDEO_EVENT_TYPES: { [ id: string ]: RequestVideoEventType } = {
  LIKES: 'likes',
  DISLIKES: 'dislikes',
  VIEWS: 'views'
}

const REMOTE_SCHEME = {
  HTTP: 'https',
  WS: 'wss'
}

const JOB_STATES: { [ id: string ]: JobState } = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  ERROR: 'error',
  SUCCESS: 'success'
}
// How many maximum jobs we fetch from the database per cycle
const JOBS_FETCH_LIMIT_PER_CYCLE = 10
const JOBS_CONCURRENCY = 1
// 1 minutes
let JOBS_FETCHING_INTERVAL = 60000

// ---------------------------------------------------------------------------

const PRIVATE_CERT_NAME = 'peertube.key.pem'
const PUBLIC_CERT_NAME = 'peertube.pub'
const SIGNATURE_ALGORITHM = 'RSA-SHA256'
const SIGNATURE_ENCODING = 'hex'

// Password encryption
const BCRYPT_SALT_SIZE = 10

// ---------------------------------------------------------------------------

// Express static paths (router)
const STATIC_PATHS = {
  PREVIEWS: '/static/previews/',
  THUMBNAILS: '/static/thumbnails/',
  TORRENTS: '/static/torrents/',
  WEBSEED: '/static/webseed/'
}

// Cache control
let STATIC_MAX_AGE = '30d'

// Videos thumbnail size
const THUMBNAILS_SIZE = '200x110'
const PREVIEWS_SIZE = '640x480'

// Sub folders of cache directory
const CACHE = {
  DIRECTORIES: {
    PREVIEWS: join(CONFIG.STORAGE.CACHE_DIR, 'previews')
  }
}

// ---------------------------------------------------------------------------

const USER_ROLES: { [ id: string ]: UserRole } = {
  ADMIN: 'admin',
  USER: 'user'
}

// ---------------------------------------------------------------------------

const OPENGRAPH_COMMENT = '<!-- open graph tags -->'

// ---------------------------------------------------------------------------

// Special constants for a test instance
if (isTestInstance() === true) {
  CONSTRAINTS_FIELDS.VIDEOS.DURATION.max = 14
  FRIEND_SCORE.BASE = 20
  REQUESTS_INTERVAL = 10000
  JOBS_FETCHING_INTERVAL = 10000
  REMOTE_SCHEME.HTTP = 'http'
  REMOTE_SCHEME.WS = 'ws'
  STATIC_MAX_AGE = '0'
}

// ---------------------------------------------------------------------------

export {
  API_VERSION,
  BCRYPT_SALT_SIZE,
  CACHE,
  CONFIG,
  CONSTRAINTS_FIELDS,
  FRIEND_SCORE,
  JOB_STATES,
  JOBS_CONCURRENCY,
  JOBS_FETCH_LIMIT_PER_CYCLE,
  JOBS_FETCHING_INTERVAL,
  LAST_MIGRATION_VERSION,
  OAUTH_LIFETIME,
  OPENGRAPH_COMMENT,
  PAGINATION_COUNT_DEFAULT,
  PODS_SCORE,
  PREVIEWS_SIZE,
  PRIVATE_CERT_NAME,
  PUBLIC_CERT_NAME,
  REMOTE_SCHEME,
  REQUEST_ENDPOINT_ACTIONS,
  REQUEST_ENDPOINTS,
  REQUEST_VIDEO_EVENT_ENDPOINT,
  REQUEST_VIDEO_EVENT_TYPES,
  REQUEST_VIDEO_QADU_ENDPOINT,
  REQUEST_VIDEO_QADU_TYPES,
  REQUESTS_IN_PARALLEL,
  REQUESTS_INTERVAL,
  REQUESTS_LIMIT_PER_POD,
  REQUESTS_LIMIT_PODS,
  REQUESTS_VIDEO_EVENT_LIMIT_PER_POD,
  REQUESTS_VIDEO_EVENT_LIMIT_PODS,
  REQUESTS_VIDEO_QADU_LIMIT_PER_POD,
  REQUESTS_VIDEO_QADU_LIMIT_PODS,
  RETRY_REQUESTS,
  SEARCHABLE_COLUMNS,
  SIGNATURE_ALGORITHM,
  SIGNATURE_ENCODING,
  SORTABLE_COLUMNS,
  STATIC_MAX_AGE,
  STATIC_PATHS,
  THUMBNAILS_SIZE,
  USER_ROLES,
  VIDEO_CATEGORIES,
  VIDEO_FILE_RESOLUTIONS,
  VIDEO_LANGUAGES,
  VIDEO_LICENCES,
  VIDEO_RATE_TYPES
}
