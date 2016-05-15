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
  deactivate: deactivate,
  forceSend: forceSend
}

function activate () {
  logger.info('Requests scheduler activated.')
  timer = setInterval(makeRequests, constants.INTERVAL)
}

function addRequest (id, type, request) {
  logger.debug('Add request to the requests scheduler.', { id: id, type: type, request: request })

  Requests.findById(id, function (err, entity) {
    if (err) {
      logger.error('Cannot find one request.', { error: err })
      return // Abort
    }

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

function makeRequest (type, requestsToMake, callback) {
  if (!callback) callback = function () {}

  Pods.list(function (err, pods) {
    if (err) return callback(err)

    const params = {
      encrypt: true,
      sign: true,
      method: 'POST',
      path: null,
      data: requestsToMake
    }

    if (type === 'add') {
      params.path = '/api/' + constants.API_VERSION + '/remotevideos/add'
    } else if (type === 'remove') {
      params.path = '/api/' + constants.API_VERSION + '/remotevideos/remove'
    } else {
      return callback(new Error('Unkown pool request type.'))
    }

    const badPods = []
    const goodPods = []

    requests.makeMultipleRetryRequest(params, pods, callbackEachPodFinished, callbackAllPodsFinished)

    function callbackEachPodFinished (err, response, body, url, pod, callbackEachPodFinished) {
      if (err || (response.statusCode !== 200 && response.statusCode !== 201 && response.statusCode !== 204)) {
        badPods.push(pod._id)
        logger.error('Error sending secure request to %s pod.', url, { error: err || new Error('Status code not 20x') })
      } else {
        goodPods.push(pod._id)
      }

      return callbackEachPodFinished()
    }

    function callbackAllPodsFinished (err) {
      if (err) return callback(err)

      updatePodsScore(goodPods, badPods)
      callback(null)
    }
  })
}

function makeRequests () {
  logger.info('Making requests to friends.')

  Requests.list(function (err, requests) {
    if (err) {
      logger.error('Cannot get the list of requests.', { err: err })
      return // Abort
    }

    if (requests.length === 0) return

    const requestsToMake = {
      add: {
        ids: [],
        requests: []
      },
      remove: {
        ids: [],
        requests: []
      }
    }

    async.each(requests, function (poolRequest, callbackEach) {
      if (poolRequest.type === 'add') {
        requestsToMake.add.requests.push(poolRequest.request)
        requestsToMake.add.ids.push(poolRequest._id)
      } else if (poolRequest.type === 'remove') {
        requestsToMake.remove.requests.push(poolRequest.request)
        requestsToMake.remove.ids.push(poolRequest._id)
      } else {
        logger.error('Unkown request type.', { request_type: poolRequest.type })
        return // abort
      }

      callbackEach()
    }, function () {
      // Send the add requests
      if (requestsToMake.add.requests.length !== 0) {
        makeRequest('add', requestsToMake.add.requests, function (err) {
          if (err) logger.error('Errors when sent add requests.', { error: err })

          Requests.removeRequests(requestsToMake.add.ids)
        })
      }

      // Send the remove requests
      if (requestsToMake.remove.requests.length !== 0) {
        makeRequest('remove', requestsToMake.remove.requests, function (err) {
          if (err) logger.error('Errors when sent remove pool requests.', { error: err })

          Requests.removeRequests(requestsToMake.remove.ids)
        })
      }
    })
  })
}

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
    if (err) logger.error('Cannot increment scores of bad pods.')
    removeBadPods()
  })
}
