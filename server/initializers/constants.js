'use strict'

// API version of our pod
const API_VERSION = 'v1'

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
  VIDEOS: [ 'name', '-name', 'duration', '-duration', 'createdDate', '-createdDate' ]
}

// Videos thumbnail size
const THUMBNAILS_SIZE = '200x110'

// Path for access to thumbnails with express router
const THUMBNAILS_STATIC_PATH = '/static/thumbnails'

const VIDEOS_CONSTRAINTS_FIELDS = {
  NAME: { min: 3, max: 50 }, // Length
  DESCRIPTION: { min: 3, max: 250 }, // Length
  MAGNET_URI: { min: 10 }, // Length
  DURATION: { min: 1, max: 7200 }, // Number
  AUTHOR: { min: 3, max: 20 }, // Length
  TAGS: { min: 1, max: 3 }, // Number of total tags
  TAG: { min: 2, max: 10 }, // Length
  THUMBNAIL: { min: 2, max: 30 },
  THUMBNAIL64: { min: 0, max: 20000 } // Bytes
}

// Special constants for a test instance
if (isTestInstance() === true) {
  FRIEND_SCORE.BASE = 20
  INTERVAL = 10000
  VIDEOS_CONSTRAINTS_FIELDS.DURATION.max = 14
}

// ---------------------------------------------------------------------------

module.exports = {
  API_VERSION: API_VERSION,
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
  VIDEOS_CONSTRAINTS_FIELDS: VIDEOS_CONSTRAINTS_FIELDS
}

// ---------------------------------------------------------------------------

function isTestInstance () {
  return (process.env.NODE_ENV === 'test')
}
