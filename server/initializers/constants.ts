import * as config from 'config'
import { join } from 'path'
import { JobCategory, JobState, VideoRateType } from '../../shared/models'
import { FollowState } from '../../shared/models/actors'
import { ActivityPubActorType } from '../../shared/models/activitypub'
import { VideoPrivacy } from '../../shared/models/videos'
// Do not use barrels, remain constants as independent as possible
import { isTestInstance, root } from '../helpers/core-utils'

// ---------------------------------------------------------------------------

const LAST_MIGRATION_VERSION = 130

// ---------------------------------------------------------------------------

// API version
const API_VERSION = 'v1'

// Number of results by default for the pagination
const PAGINATION_COUNT_DEFAULT = 15

// Sortable columns per schema
const SORTABLE_COLUMNS = {
  USERS: [ 'id', 'username', 'createdAt' ],
  JOBS: [ 'id', 'createdAt' ],
  VIDEO_ABUSES: [ 'id', 'createdAt' ],
  VIDEO_CHANNELS: [ 'id', 'name', 'updatedAt', 'createdAt' ],
  VIDEOS: [ 'name', 'duration', 'createdAt', 'views', 'likes' ],
  BLACKLISTS: [ 'id', 'name', 'duration', 'views', 'likes', 'dislikes', 'uuid', 'createdAt' ],
  FOLLOWERS: [ 'createdAt' ],
  FOLLOWING: [ 'createdAt' ]
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
    AVATARS_DIR: join(root(), config.get<string>('storage.avatars')),
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
    THREADS: config.get<number>('transcoding.threads'),
    RESOLUTIONS: {
      '240' : config.get<boolean>('transcoding.resolutions.240p'),
      '360': config.get<boolean>('transcoding.resolutions.360p'),
      '480': config.get<boolean>('transcoding.resolutions.480p'),
      '720': config.get<boolean>('transcoding.resolutions.720p'),
      '1080': config.get<boolean>('transcoding.resolutions.1080p')
    }
  },
  CACHE: {
    PREVIEWS: {
      SIZE: config.get<number>('cache.previews.size')
    }
  }
}
CONFIG.WEBSERVER.URL = CONFIG.WEBSERVER.SCHEME + '://' + CONFIG.WEBSERVER.HOSTNAME + ':' + CONFIG.WEBSERVER.PORT
CONFIG.WEBSERVER.HOST = CONFIG.WEBSERVER.HOSTNAME + ':' + CONFIG.WEBSERVER.PORT

const AVATARS_DIR = {
  ACCOUNT: join(CONFIG.STORAGE.AVATARS_DIR, 'account')
}
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
  VIDEO_CHANNELS: {
    NAME: { min: 3, max: 120 }, // Length
    DESCRIPTION: { min: 3, max: 250 }, // Length
    URL: { min: 3, max: 2000 } // Length
  },
  VIDEOS: {
    NAME: { min: 3, max: 120 }, // Length
    TRUNCATED_DESCRIPTION: { min: 3, max: 250 }, // Length
    DESCRIPTION: { min: 3, max: 3000 }, // Length
    EXTNAME: [ '.mp4', '.ogv', '.webm' ],
    INFO_HASH: { min: 40, max: 40 }, // Length, info hash is 20 bytes length but we represent it in hexadecimal so 20 * 2
    DURATION: { min: 1 }, // Number
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
  ACTOR: {
    PUBLIC_KEY: { min: 10, max: 5000 }, // Length
    PRIVATE_KEY: { min: 10, max: 5000 }, // Length
    URL: { min: 3, max: 2000 } // Length
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
  14: 'Italian'
}

const VIDEO_PRIVACIES = {
  [VideoPrivacy.PUBLIC]: 'Public',
  [VideoPrivacy.UNLISTED]: 'Unlisted',
  [VideoPrivacy.PRIVATE]: 'Private'
}

const VIDEO_MIMETYPE_EXT = {
  'video/webm': '.webm',
  'video/ogg': '.ogv',
  'video/mp4': '.mp4'
}

// ---------------------------------------------------------------------------

const SERVER_ACTOR_NAME = 'peertube'

const ACTIVITY_PUB = {
  POTENTIAL_ACCEPT_HEADERS: [
    'application/activity+json',
    'application/ld+json'
  ],
  ACCEPT_HEADER: 'application/activity+json, application/ld+json',
  PUBLIC: 'https://www.w3.org/ns/activitystreams#Public',
  COLLECTION_ITEMS_PER_PAGE: 10,
  FETCH_PAGE_LIMIT: 100,
  MAX_HTTP_ATTEMPT: 5,
  URL_MIME_TYPES: {
    VIDEO: [ 'video/mp4', 'video/webm', 'video/ogg' ], // TODO: Merge with VIDEO_MIMETYPE_EXT
    TORRENT: [ 'application/x-bittorrent' ],
    MAGNET: [ 'application/x-bittorrent;x-scheme-handler/magnet' ]
  }
}

const ACTIVITY_PUB_ACTOR_TYPES: { [ id: string ]: ActivityPubActorType } = {
  GROUP: 'Group',
  PERSON: 'Person',
  APPLICATION: 'Application'
}

// ---------------------------------------------------------------------------

// Number of points we add/remove from a friend after a successful/bad request
const SERVERS_SCORE = {
  PENALTY: -10,
  BONUS: 10,
  BASE: 100,
  MAX: 1000
}

const FOLLOW_STATES: { [ id: string ]: FollowState } = {
  PENDING: 'pending',
  ACCEPTED: 'accepted'
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
const JOB_CATEGORIES: { [ id: string ]: JobCategory } = {
  TRANSCODING: 'transcoding',
  ACTIVITYPUB_HTTP: 'activitypub-http'
}
// How many maximum jobs we fetch from the database per cycle
const JOBS_FETCH_LIMIT_PER_CYCLE = {
  transcoding: 10,
  httpRequest: 20
}
// 1 minutes
let JOBS_FETCHING_INTERVAL = 60000

// ---------------------------------------------------------------------------

const PRIVATE_RSA_KEY_SIZE = 2048

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
const THUMBNAILS_SIZE = {
  width: 200,
  height: 110
}
const PREVIEWS_SIZE = {
  width: 560,
  height: 315
}

const EMBED_SIZE = {
  width: 560,
  height: 315
}

// Sub folders of cache directory
const CACHE = {
  DIRECTORIES: {
    PREVIEWS: join(CONFIG.STORAGE.CACHE_DIR, 'previews')
  }
}

const ACCEPT_HEADERS = ACTIVITY_PUB.POTENTIAL_ACCEPT_HEADERS.concat('html', 'application/json')

// ---------------------------------------------------------------------------

const OPENGRAPH_AND_OEMBED_COMMENT = '<!-- open graph and oembed tags -->'

// ---------------------------------------------------------------------------

// Special constants for a test instance
if (isTestInstance() === true) {
  SERVERS_SCORE.BASE = 20
  JOBS_FETCHING_INTERVAL = 1000
  REMOTE_SCHEME.HTTP = 'http'
  REMOTE_SCHEME.WS = 'ws'
  STATIC_MAX_AGE = '0'
  ACTIVITY_PUB.COLLECTION_ITEMS_PER_PAGE = 2
}

// ---------------------------------------------------------------------------

export {
  API_VERSION,
  ACCEPT_HEADERS,
  BCRYPT_SALT_SIZE,
  CACHE,
  CONFIG,
  CONSTRAINTS_FIELDS,
  EMBED_SIZE,
  JOB_STATES,
  JOBS_FETCH_LIMIT_PER_CYCLE,
  JOBS_FETCHING_INTERVAL,
  JOB_CATEGORIES,
  LAST_MIGRATION_VERSION,
  OAUTH_LIFETIME,
  OPENGRAPH_AND_OEMBED_COMMENT,
  PAGINATION_COUNT_DEFAULT,
  SERVERS_SCORE,
  PREVIEWS_SIZE,
  REMOTE_SCHEME,
  FOLLOW_STATES,
  AVATARS_DIR,
  SERVER_ACTOR_NAME,
  PRIVATE_RSA_KEY_SIZE,
  SORTABLE_COLUMNS,
  STATIC_MAX_AGE,
  STATIC_PATHS,
  ACTIVITY_PUB,
  ACTIVITY_PUB_ACTOR_TYPES,
  THUMBNAILS_SIZE,
  VIDEO_CATEGORIES,
  VIDEO_LANGUAGES,
  VIDEO_PRIVACIES,
  VIDEO_LICENCES,
  VIDEO_RATE_TYPES,
  VIDEO_MIMETYPE_EXT
}
