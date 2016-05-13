'use strict'

// API version of our pod
const API_VERSION = 'v1'

// Score a pod has when we create it as a friend
let FRIEND_BASE_SCORE = 100

// Time to wait between requests to the friends
let INTERVAL = 60000

// Number of results by default for the pagination
const PAGINATION_COUNT_DEFAULT = 15

// Number of points we add/remove from a friend after a successful/bad request
const PODS_SCORE = {
  MALUS: -10,
  BONUS: 10
}

// Number of retries we make for the make retry requests (to friends...)
let REQUEST_RETRIES = 10

// Videos thumbnail size
const THUMBNAILS_SIZE = '200x110'

// Path for access to thumbnails with express router
const THUMBNAILS_STATIC_PATH = '/static/thumbnails'

// Special constants for a test instance
if (isTestInstance() === true) {
  FRIEND_BASE_SCORE = 20
  INTERVAL = 10000
  REQUEST_RETRIES = 2
}

// ---------------------------------------------------------------------------

module.exports = {
  API_VERSION: API_VERSION,
  FRIEND_BASE_SCORE: FRIEND_BASE_SCORE,
  INTERVAL: INTERVAL,
  PAGINATION_COUNT_DEFAULT: PAGINATION_COUNT_DEFAULT,
  PODS_SCORE: PODS_SCORE,
  REQUEST_RETRIES: REQUEST_RETRIES,
  THUMBNAILS_SIZE: THUMBNAILS_SIZE,
  THUMBNAILS_STATIC_PATH: THUMBNAILS_STATIC_PATH
}

// ---------------------------------------------------------------------------

function isTestInstance () {
  return (process.env.NODE_ENV === 'test')
}
