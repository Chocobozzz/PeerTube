;(function () {
  'use strict'

  var constants = {}

  function isTestInstance () {
    return (process.env.NODE_ENV === 'test')
  }

  // API version of our pod
  constants.API_VERSION = 'v1'

  // Score a pod has when we create it as a friend
  constants.FRIEND_BASE_SCORE = 100

  // Time to wait between requests to the friends
  constants.INTERVAL = 60000

  // Number of points we add/remove from a friend after a successful/bad request
  constants.PODS_SCORE = {
    MALUS: -10,
    BONUS: 10
  }

  // Number of retries we make for the make retry requests (to friends...)
  constants.REQUEST_RETRIES = 10

  // Special constants for a test instance
  if (isTestInstance() === true) {
    constants.FRIEND_BASE_SCORE = 20
    constants.INTERVAL = 10000
    constants.REQUEST_RETRIES = 2
  }

  // ----------- Export -----------
  module.exports = constants
})()
