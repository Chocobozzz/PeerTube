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

function makeRequest (type, requests_to_make, callback) {
  if (!callback) callback = function () {}

  Pods.list(function (err, pods) {
    if (err) return callback(err)

    const params = {
      encrypt: true,
      sign: true,
      method: 'POST',
      path: null,
      data: requests_to_make
    }

    if (type === 'add') {
      params.path = '/api/' + constants.API_VERSION + '/remotevideos/add'
    } else if (type === 'remove') {
      params.path = '/api/' + constants.API_VERSION + '/remotevideos/remove'
    } else {
      return callback(new Error('Unkown pool request type.'))
    }

    const bad_pods = []
    const good_pods = []

    requests.makeMultipleRetryRequest(params, pods, callbackEachPodFinished, callbackAllPodsFinished)

    function callbackEachPodFinished (err, response, body, url, pod, callback_each_pod_finished) {
      if (err || (response.statusCode !== 200 && response.statusCode !== 201 && response.statusCode !== 204)) {
        bad_pods.push(pod._id)
        logger.error('Error sending secure request to %s pod.', url, { error: err || new Error('Status code not 20x') })
      } else {
        good_pods.push(pod._id)
      }

      return callback_each_pod_finished()
    }

    function callbackAllPodsFinished (err) {
      if (err) return callback(err)

      updatePodsScore(good_pods, bad_pods)
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

    const requests_to_make = {
      add: {
        ids: [],
        requests: []
      },
      remove: {
        ids: [],
        requests: []
      }
    }

    async.each(requests, function (pool_request, callback_each) {
      if (pool_request.type === 'add') {
        requests_to_make.add.requests.push(pool_request.request)
        requests_to_make.add.ids.push(pool_request._id)
      } else if (pool_request.type === 'remove') {
        requests_to_make.remove.requests.push(pool_request.request)
        requests_to_make.remove.ids.push(pool_request._id)
      } else {
        logger.error('Unkown request type.', { request_type: pool_request.type })
        return // abort
      }

      callback_each()
    }, function () {
      // Send the add requests
      if (requests_to_make.add.requests.length !== 0) {
        makeRequest('add', requests_to_make.add.requests, function (err) {
          if (err) logger.error('Errors when sent add requests.', { error: err })

          Requests.removeRequests(requests_to_make.add.ids)
        })
      }

      // Send the remove requests
      if (requests_to_make.remove.requests.length !== 0) {
        makeRequest('remove', requests_to_make.remove.requests, function (err) {
          if (err) logger.error('Errors when sent remove pool requests.', { error: err })

          Requests.removeRequests(requests_to_make.remove.ids)
        })
      }
    })
  })
}

function removeBadPods () {
  Pods.findBadPods(function (err, pods) {
    if (err) {
      logger.error('Cannot find bad pods.', { error: err })
      return // abort
    }

    if (pods.length === 0) return

    const urls = map(pods, 'url')
    const ids = map(pods, '_id')

    Videos.listFromUrls(urls, function (err, videos_list) {
      if (err) {
        logger.error('Cannot list videos urls.', { error: err, urls: urls })
      } else {
        videos.removeRemoteVideos(videos_list, function (err) {
          if (err) logger.error('Cannot remove remote videos.', { error: err })
        })
      }

      Pods.removeAllByIds(ids, function (err, r) {
        if (err) {
          logger.error('Cannot remove bad pods.', { error: err })
        } else {
          const pods_removed = r.result.n
          logger.info('Removed %d pods.', pods_removed)
        }
      })
    })
  })
}

function updatePodsScore (good_pods, bad_pods) {
  logger.info('Updating %d good pods and %d bad pods scores.', good_pods.length, bad_pods.length)

  Pods.incrementScores(good_pods, constants.PODS_SCORE.BONUS, function (err) {
    if (err) logger.error('Cannot increment scores of good pods.')
  })

  Pods.incrementScores(bad_pods, constants.PODS_SCORE.MALUS, function (err) {
    if (err) logger.error('Cannot increment scores of bad pods.')
    removeBadPods()
  })
}
