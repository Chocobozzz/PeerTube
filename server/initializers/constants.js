'use strict'

const config = require('config')
const path = require('path')

// API version of our pod
const API_VERSION = 'v1'

const CONFIG = {
  DATABASE: {
    DBNAME: 'peertube' + config.get('database.suffix'),
    HOST: config.get('database.host'),
    PORT: config.get('database.port')
  },
  ELECTRON: {
    DEBUG: config.get('electron.debug')
  },
  STORAGE: {
    CERT_DIR: path.join(__dirname, '..', '..', config.get('storage.certs')),
    LOG_DIR: path.join(__dirname, '..', '..', config.get('storage.logs')),
    UPLOAD_DIR: path.join(__dirname, '..', '..', config.get('storage.uploads')),
    THUMBNAILS_DIR: path.join(__dirname, '..', '..', config.get('storage.thumbnails'))
  },
  WEBSERVER: {
    SCHEME: config.get('webserver.https') === true ? 'https' : 'http',
    HOST: config.get('webserver.host'),
    PORT: config.get('webserver.port')
  }
}
CONFIG.WEBSERVER.URL = CONFIG.WEBSERVER.SCHEME + '://' + CONFIG.WEBSERVER.HOST + ':' + CONFIG.WEBSERVER.PORT

const CONSTRAINTS_FIELDS = {
  USERS: {
    USERNAME: { min: 3, max: 20 }, // Length
    PASSWORD: { min: 6, max: 255 } // Length
  },
  VIDEOS: {
    NAME: { min: 3, max: 50 }, // Length
    DESCRIPTION: { min: 3, max: 250 }, // Length
    MAGNET_URI: { min: 10 }, // Length
    DURATION: { min: 1, max: 7200 }, // Number
    TAGS: { min: 1, max: 3 }, // Number of total tags
    TAG: { min: 2, max: 10 }, // Length
    THUMBNAIL: { min: 2, max: 30 },
    THUMBNAIL64: { min: 0, max: 20000 } // Bytes
  }
}

// Score a pod has when we create it as a friend
const FRIEND_SCORE = {
  BASE: 100,
  MAX: 1000
}

// Time to wait between requests to the friends (10 min)
let INTERVAL = 600000

const OAUTH_LIFETIME = {
  ACCESS_TOKEN: 3600 * 4, // 4 hours
  REFRESH_TOKEN: 1209600 // 2 weeks
}

// Number of results by default for the pagination
const PAGINATION_COUNT_DEFAULT = 15

// Number of points we add/remove from a friend after a successful/bad request
const PODS_SCORE = {
  MALUS: -10,
  BONUS: 10
}

// Number of requests in parallel we can make
const REQUESTS_IN_PARALLEL = 10

// How many requests we put in request (request scheduler)
const REQUESTS_LIMIT = 10

// Number of requests to retry for replay requests module
const RETRY_REQUESTS = 5

// Sortable columns per schema
const SEARCHABLE_COLUMNS = {
  VIDEOS: [ 'name', 'magnetUri', 'podUrl', 'author', 'tags' ]
}

// Seeds in parallel we send to electron when "seed all"
// Once a video is in seeding state we seed another video etc
const SEEDS_IN_PARALLEL = 3

// Sortable columns per schema
const SORTABLE_COLUMNS = {
  USERS: [ 'username', '-username', 'createdDate', '-createdDate' ],
  VIDEOS: [ 'name', '-name', 'duration', '-duration', 'createdDate', '-createdDate' ]
}

// Videos thumbnail size
const THUMBNAILS_SIZE = '200x110'

// Path for access to thumbnails with express router
const THUMBNAILS_STATIC_PATH = '/static/thumbnails'

const USER_ROLES = {
  ADMIN: 'admin',
  USER: 'user'
}

// Special constants for a test instance
if (isTestInstance() === true) {
  FRIEND_SCORE.BASE = 20
  INTERVAL = 10000
  CONSTRAINTS_FIELDS.VIDEOS.DURATION.max = 14
}

// ---------------------------------------------------------------------------

module.exports = {
  API_VERSION: API_VERSION,
  CONFIG: CONFIG,
  CONSTRAINTS_FIELDS: CONSTRAINTS_FIELDS,
  FRIEND_SCORE: FRIEND_SCORE,
  INTERVAL: INTERVAL,
  OAUTH_LIFETIME: OAUTH_LIFETIME,
  PAGINATION_COUNT_DEFAULT: PAGINATION_COUNT_DEFAULT,
  PODS_SCORE: PODS_SCORE,
  REQUESTS_IN_PARALLEL: REQUESTS_IN_PARALLEL,
  REQUESTS_LIMIT: REQUESTS_LIMIT,
  RETRY_REQUESTS: RETRY_REQUESTS,
  SEARCHABLE_COLUMNS: SEARCHABLE_COLUMNS,
  SEEDS_IN_PARALLEL: SEEDS_IN_PARALLEL,
  SORTABLE_COLUMNS: SORTABLE_COLUMNS,
  THUMBNAILS_SIZE: THUMBNAILS_SIZE,
  THUMBNAILS_STATIC_PATH: THUMBNAILS_STATIC_PATH,
  USER_ROLES: USER_ROLES
}

// ---------------------------------------------------------------------------

function isTestInstance () {
  return (process.env.NODE_ENV === 'test')
}
