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

let timer = null

const requestsScheduler = {
  activate: activate,
  addRequest: addRequest,
  addRequestTo: addRequestTo,
  deactivate: deactivate,
  flush: flush,
  forceSend: forceSend
}

function activate () {
  logger.info('Requests scheduler activated.')
  timer = setInterval(makeRequests, constants.INTERVAL)
}

// Add request to the scheduler
function addRequest (type, data) {
  logger.debug('Add request of type %s to the requests scheduler.', type, { data: data })

  const request = {
    type: type,
    data: data
  }

  Pods.listAllIds(function (err, podIds) {
    if (err) {
      logger.debug('Cannot list pod ids.')
      return
    }

    // No friends
    if (!podIds) return

    Requests.create(request, podIds, function (err) {
      if (err) logger.error('Cannot create a request.', { error: err })
    })
  })
}

function addRequestTo (podIds, type, data) {
  const request = {
    type: type,
    data: data
  }

  Requests.create(request, podIds, function (err) {
    if (err) logger.error('Cannot create a request.', { error: err })
  })
}

function deactivate () {
  logger.info('Requests scheduler deactivated.')
  clearInterval(timer)
}

function flush () {
  Requests.removeAll(function (err) {
    if (err) {
      logger.error('Cannot flush the requests.', { error: err })
    }
  })
}

function forceSend () {
  logger.info('Force requests scheduler sending.')
  makeRequests()
}

// ---------------------------------------------------------------------------

module.exports = requestsScheduler

// ---------------------------------------------------------------------------

// Make a requests to friends of a certain type
function makeRequest (toPod, requestsToMake, callback) {
  if (!callback) callback = function () {}

  const params = {
    toPod: toPod,
    encrypt: true, // Security
    sign: true, // To prove our identity
    method: 'POST',
    path: '/api/' + constants.API_VERSION + '/remote/videos',
    data: requestsToMake // Requests we need to make
  }

  // Make multiple retry requests to all of pods
  // The function fire some useful callbacks
  requests.makeSecureRequest(params, function (err, res) {
    if (err || (res.statusCode !== 200 && res.statusCode !== 201 && res.statusCode !== 204)) {
      logger.error('Error sending secure request to %s pod.', toPod.url, { error: err || new Error('Status code not 20x') })

      return callback(false)
    }

    return callback(true)
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

    // Requests by pods id
    const requestsToMake = {}

    requests.forEach(function (poolRequest) {
      poolRequest.to.forEach(function (toPodId) {
        if (!requestsToMake[toPodId]) {
          requestsToMake[toPodId] = {
            ids: [],
            datas: []
          }
        }

        requestsToMake[toPodId].ids.push(poolRequest._id)
        requestsToMake[toPodId].datas.push(poolRequest.request)
      })
    })

    const goodPods = []
    const badPods = []

    async.eachLimit(Object.keys(requestsToMake), constants.REQUESTS_IN_PARALLEL, function (toPodId, callbackEach) {
      const requestToMake = requestsToMake[toPodId]

      // FIXME: mongodb request inside a loop :/
      Pods.findById(toPodId, function (err, toPod) {
        if (err) return logger.error('Error finding pod by id.', { err: err })

        // Maybe the pod is not our friend anymore so simply remove them
        if (!toPod) {
          Requests.removePodOf(requestToMake.ids, toPodId)
          return callbackEach()
        }

        makeRequest(toPod, requestToMake.datas, function (success) {
          if (err) {
            logger.error('Errors when sent request to %s.', toPod.url, { error: err })
            // Do not stop the process just for one error
            return callbackEach()
          }

          if (success === true) {
            logger.debug('Removing requests for %s pod.', toPodId, { requestsIds: requestToMake.ids })

            // Remove the pod id of these request ids
            Requests.removePodOf(requestToMake.ids, toPodId)
            goodPods.push(toPodId)
          } else {
            badPods.push(toPodId)
          }

          callbackEach()
        })
      })
    }, function () {
      // All the requests were made, we update the pods score
      updatePodsScore(goodPods, badPods)
      // Flush requests with no pod
      Requests.removeWithEmptyTo()
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
