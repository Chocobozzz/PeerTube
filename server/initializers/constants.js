'use strict'

const config = require('config')
const maxBy = require('lodash/maxBy')
const path = require('path')

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
  USERS: [ 'username', '-username', 'createdAt', '-createdAt' ],
  VIDEOS: [ 'name', '-name', 'duration', '-duration', 'createdAt', '-createdAt' ]
}

const OAUTH_LIFETIME = {
  ACCESS_TOKEN: 3600 * 4, // 4 hours
  REFRESH_TOKEN: 1209600 // 2 weeks
}

// ---------------------------------------------------------------------------

const CONFIG = {
  LISTEN: {
    PORT: config.get('listen.port')
  },
  DATABASE: {
    DBNAME: 'peertube' + config.get('database.suffix'),
    HOSTNAME: config.get('database.hostname'),
    PORT: config.get('database.port'),
    USERNAME: config.get('database.username'),
    PASSWORD: config.get('database.password')
  },
  STORAGE: {
    CERT_DIR: path.join(__dirname, '..', '..', config.get('storage.certs')),
    LOG_DIR: path.join(__dirname, '..', '..', config.get('storage.logs')),
    VIDEOS_DIR: path.join(__dirname, '..', '..', config.get('storage.videos')),
    THUMBNAILS_DIR: path.join(__dirname, '..', '..', config.get('storage.thumbnails')),
    PREVIEWS_DIR: path.join(__dirname, '..', '..', config.get('storage.previews')),
    TORRENTS_DIR: path.join(__dirname, '..', '..', config.get('storage.torrents'))
  },
  WEBSERVER: {
    SCHEME: config.get('webserver.https') === true ? 'https' : 'http',
    WS: config.get('webserver.https') === true ? 'wss' : 'ws',
    HOSTNAME: config.get('webserver.hostname'),
    PORT: config.get('webserver.port')
  }
}
CONFIG.WEBSERVER.URL = CONFIG.WEBSERVER.SCHEME + '://' + CONFIG.WEBSERVER.HOSTNAME + ':' + CONFIG.WEBSERVER.PORT
CONFIG.WEBSERVER.HOST = CONFIG.WEBSERVER.HOSTNAME + ':' + CONFIG.WEBSERVER.PORT

// ---------------------------------------------------------------------------

const CONSTRAINTS_FIELDS = {
  USERS: {
    USERNAME: { min: 3, max: 20 }, // Length
    PASSWORD: { min: 6, max: 255 } // Length
  },
  VIDEOS: {
    NAME: { min: 3, max: 50 }, // Length
    DESCRIPTION: { min: 3, max: 250 }, // Length
    EXTNAME: [ '.mp4', '.ogv', '.webm' ],
    INFO_HASH: { min: 10, max: 50 }, // Length
    DURATION: { min: 1, max: 7200 }, // Number
    TAGS: { min: 1, max: 3 }, // Number of total tags
    TAG: { min: 2, max: 10 }, // Length
    THUMBNAIL: { min: 2, max: 30 },
    THUMBNAIL64: { min: 0, max: 20000 } // Bytes
  }
}

// ---------------------------------------------------------------------------

// Score a pod has when we create it as a friend
const FRIEND_SCORE = {
  BASE: 100,
  MAX: 1000
}

// ---------------------------------------------------------------------------

const LAST_MIGRATION_VERSION = 0

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

// How many requests we put in request
const REQUESTS_LIMIT = 10

// Number of requests to retry for replay requests module
const RETRY_REQUESTS = 5

const REQUEST_ENDPOINTS = {
  VIDEOS: 'videos'
}

// ---------------------------------------------------------------------------

const REMOTE_SCHEME = {
  HTTP: 'https',
  WS: 'wss'
}

// Password encryption
const BCRYPT_SALT_SIZE = 10

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

const USER_ROLES = {
  ADMIN: 'admin',
  USER: 'user'
}

// ---------------------------------------------------------------------------

// Special constants for a test instance
if (isTestInstance() === true) {
  CONSTRAINTS_FIELDS.VIDEOS.DURATION.max = 14
  FRIEND_SCORE.BASE = 20
  REQUESTS_INTERVAL = 10000
  REMOTE_SCHEME.HTTP = 'http'
  REMOTE_SCHEME.WS = 'ws'
  STATIC_MAX_AGE = 0
}

// ---------------------------------------------------------------------------

module.exports = {
  API_VERSION,
  BCRYPT_SALT_SIZE,
  CONFIG,
  CONSTRAINTS_FIELDS,
  FRIEND_SCORE,
  LAST_MIGRATION_VERSION,
  OAUTH_LIFETIME,
  PAGINATION_COUNT_DEFAULT,
  PODS_SCORE,
  PREVIEWS_SIZE,
  REMOTE_SCHEME,
  REQUEST_ENDPOINTS,
  REQUESTS_IN_PARALLEL,
  REQUESTS_INTERVAL,
  REQUESTS_LIMIT,
  RETRY_REQUESTS,
  SEARCHABLE_COLUMNS,
  SORTABLE_COLUMNS,
  STATIC_MAX_AGE,
  STATIC_PATHS,
  THUMBNAILS_SIZE,
  USER_ROLES
}

// ---------------------------------------------------------------------------

// This method exists in utils module but we want to let the constants module independent
function isTestInstance () {
  return (process.env.NODE_ENV === 'test')
}
