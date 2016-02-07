'use strict'

// API version of our pod
var API_VERSION = 'v1'

// Score a pod has when we create it as a friend
var FRIEND_BASE_SCORE = 100

// Time to wait between requests to the friends
var INTERVAL = 60000

// Number of points we add/remove from a friend after a successful/bad request
var PODS_SCORE = {
  MALUS: -10,
  BONUS: 10
}

// Number of retries we make for the make retry requests (to friends...)
var REQUEST_RETRIES = 10

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
  PODS_SCORE: PODS_SCORE,
  REQUEST_RETRIES: REQUEST_RETRIES
}

// ---------------------------------------------------------------------------

function isTestInstance () {
  return (process.env.NODE_ENV === 'test')
}
