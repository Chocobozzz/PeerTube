'use strict'

const async = require('async')
const map = require('lodash/map')

const constants = require('../initializers/constants')
const logger = require('../helpers/logger')
const Pods = require('../models/pods')
const Requests = require('../models/requests')
const requests = require('../helpers/requests')
const videos = require('../lib/videos')
const Videos = require('../models/videos')

const REQUEST_SCHEDULER_TYPE = constants.REQUEST_SCHEDULER_TYPE
let timer = null

const requestsScheduler = {
  activate: activate,
  addRequest: addRequest,
  deactivate: deactivate,
  forceSend: forceSend
}

function activate () {
  logger.info('Requests scheduler activated.')
  timer = setInterval(makeRequests, constants.INTERVAL)
}

// Add request to the scheduler
function addRequest (id, type, request) {
  logger.debug('Add request to the requests scheduler.', { id: id, type: type, request: request })

  Requests.findById(id, function (err, entity) {
    if (err) {
      logger.error('Error when trying to find a request.', { error: err })
      return // Abort
    }

    // If there were already a request with this id in the scheduler...
    if (entity) {
      if (entity.type === type) {
        logger.error('Cannot insert two same requests.')
        return // Abort
      }

      // Remove the request of the other type
      Requests.removeRequestById(id, function (err) {
        if (err) {
          logger.error('Cannot remove a request.', { error: err })
          return // Abort
        }
      })
    } else {
      Requests.create(id, type, request, function (err) {
        if (err) logger.error('Cannot create a request.', { error: err })
        return // Abort
      })
    }
  })
}

function deactivate () {
  logger.info('Requests scheduler deactivated.')
  clearInterval(timer)
}

function forceSend () {
  logger.info('Force requests scheduler sending.')
  makeRequests()
}

// ---------------------------------------------------------------------------

module.exports = requestsScheduler

// ---------------------------------------------------------------------------

// Make a requests to friends of a certain type
function makeRequest (type, requestsToMake, callback) {
  if (!callback) callback = function () {}

  Pods.list(function (err, pods) {
    if (err) return callback(err)

    const params = {
      encrypt: true, // Security
      sign: true, // To prove our identity
      method: 'POST',
      path: null, // We build the path later
      data: requestsToMake // Requests we need to make
    }

    // If this is a valid type, we build the path
    if (REQUEST_SCHEDULER_TYPE.indexOf(type) > -1) {
      params.path = '/api/' + constants.API_VERSION + '/remotevideos/' + type
    } else {
      return callback(new Error('Unkown pool request type.'))
    }

    const badPods = []
    const goodPods = []

    // Make multiple retry requests to all of pods
    // The function fire some useful callbacks
    requests.makeMultipleRetryRequest(params, pods, callbackEachPodFinished, callbackAllPodsFinished)

    function callbackEachPodFinished (err, response, body, url, pod, callbackEachPodFinished) {
      // We failed the request, add the pod unreachable to the bad pods list
      if (err || (response.statusCode !== 200 && response.statusCode !== 201 && response.statusCode !== 204)) {
        badPods.push(pod._id)
        logger.error('Error sending secure request to %s pod.', url, { error: err || new Error('Status code not 20x') })
      } else {
        // Request success
        goodPods.push(pod._id)
      }

      return callbackEachPodFinished()
    }

    function callbackAllPodsFinished (err) {
      if (err) return callback(err)

      // All the requests were made, we update the pods score
      updatePodsScore(goodPods, badPods)
      callback(null)
    }
  })
}

// Make all the requests of the scheduler
function makeRequests () {
  Requests.list(function (err, requests) {
    if (err) {
      logger.error('Cannot get the list of requests.', { err: err })
      return // Abort
    }

    // If there are no requests, abort
    if (requests.length === 0) {
      logger.info('No requests to make.')
      return
    }

    logger.info('Making requests to friends.')

    const requestsToMake = {}
    for (const type of REQUEST_SCHEDULER_TYPE) {
      requestsToMake[type] = {
        ids: [],
        requests: []
      }
    }

    // For each requests to make, we add it to the correct request type
    async.each(requests, function (poolRequest, callbackEach) {
      if (REQUEST_SCHEDULER_TYPE.indexOf(poolRequest.type) > -1) {
        const requestTypeToMake = requestsToMake[poolRequest.type]
        requestTypeToMake.requests.push(poolRequest.request)
        requestTypeToMake.ids.push(poolRequest._id)
      } else {
        logger.error('Unkown request type.', { request_type: poolRequest.type })
        return // abort
      }

      callbackEach()
    }, function () {
      for (let type of Object.keys(requestsToMake)) {
        const requestTypeToMake = requestsToMake[type]
        // If there are requests for this type
        if (requestTypeToMake.requests.length !== 0) {
          makeRequest(type, requestTypeToMake.requests, function (err) {
            if (err) logger.error('Errors when sent ' + type + ' requests.', { error: err })

            // We made the requests, so we can remove them from the scheduler
            Requests.removeRequests(requestTypeToMake.ids)
          })
        }
      }
    })
  })
}

// Remove pods with a score of 0 (too many requests where they were unreachable)
function removeBadPods () {
  async.waterfall([
    function findBadPods (callback) {
      Pods.findBadPods(function (err, pods) {
        if (err) {
          logger.error('Cannot find bad pods.', { error: err })
          return callback(err)
        }

        return callback(null, pods)
      })
    },

    function listVideosOfTheseBadPods (pods, callback) {
      if (pods.length === 0) return callback(null)

      const urls = map(pods, 'url')
      const ids = map(pods, '_id')

      Videos.listFromUrls(urls, function (err, videosList) {
        if (err) {
          logger.error('Cannot list videos urls.', { error: err, urls: urls })
          return callback(null, ids, [])
        }

        return callback(null, ids, videosList)
      })
    },

    function removeVideosOfTheseBadPods (podIds, videosList, callback) {
      // We don't have to remove pods, skip
      if (typeof podIds === 'function') return podIds(null)

      // Remove the remote videos
      videos.removeRemoteVideos(videosList, function (err) {
        if (err) logger.error('Cannot remove remote videos.', { error: err })

        return callback(null, podIds)
      })
    },

    function removeBadPodsFromDB (podIds, callback) {
      // We don't have to remove pods, skip
      if (typeof podIds === 'function') return podIds(null)

      Pods.removeAllByIds(podIds, callback)
    }
  ], function (err, removeResult) {
    if (err) {
      logger.error('Cannot remove bad pods.', { error: err })
    } else if (removeResult) {
      const podsRemoved = removeResult.result.n
      logger.info('Removed %d pods.', podsRemoved)
    } else {
      logger.info('No need to remove bad pods.')
    }
  })
}

function updatePodsScore (goodPods, badPods) {
  logger.info('Updating %d good pods and %d bad pods scores.', goodPods.length, badPods.length)

  Pods.incrementScores(goodPods, constants.PODS_SCORE.BONUS, function (err) {
    if (err) logger.error('Cannot increment scores of good pods.')
  })

  Pods.incrementScores(badPods, constants.PODS_SCORE.MALUS, function (err) {
    if (err) logger.error('Cannot decrement scores of bad pods.')
    removeBadPods()
  })
}
