;(function () {
  'use strict'

  var async = require('async')
  var pluck = require('lodash-node/compat/collection/pluck')

  var constants = require('../initializers/constants')
  var logger = require('../helpers/logger')
  var Pods = require('../models/pods')
  var PoolRequests = require('../models/poolRequests')
  var requests = require('../helpers/requests')
  var Videos = require('../models/videos')

  var timer = null

  var poolRequests = {
    activate: activate,
    addRequest: addRequest,
    deactivate: deactivate,
    forceSend: forceSend
  }

  function activate () {
    logger.info('Pool requests activated.')
    timer = setInterval(makePoolRequests, constants.INTERVAL)
  }

  function addRequest (id, type, request) {
    logger.debug('Add request to the pool requests.', { id: id, type: type, request: request })

    PoolRequests.findById(id, function (err, entity) {
      if (err) {
        logger.error('Cannot find one pool request.', { error: err })
        return // Abort
      }

      if (entity) {
        if (entity.type === type) {
          logger.error('Cannot insert two same requests.')
          return // Abort
        }

        // Remove the request of the other type
        PoolRequests.removeRequestById(id, function (err) {
          if (err) {
            logger.error('Cannot remove a pool request.', { error: err })
            return // Abort
          }
        })
      } else {
        PoolRequests.create(id, type, request, function (err) {
          if (err) logger.error('Cannot create a pool request.', { error: err })
          return // Abort
        })
      }
    })
  }

  function deactivate () {
    logger.info('Pool requests deactivated.')
    clearInterval(timer)
  }

  function forceSend () {
    logger.info('Force pool requests sending.')
    makePoolRequests()
  }

  // ---------------------------------------------------------------------------

  module.exports = poolRequests

  // ---------------------------------------------------------------------------

  function makePoolRequest (type, requests_to_make, callback) {
    if (!callback) callback = function () {}

    Pods.list(function (err, pods) {
      if (err) return callback(err)

      var params = {
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

      var bad_pods = []
      var good_pods = []

      requests.makeMultipleRetryRequest(params, pods, callbackEachPodFinished, callbackAllPodsFinished)

      function callbackEachPodFinished (err, response, body, url, pod, callback_each_pod_finished) {
        if (err || (response.statusCode !== 200 && response.statusCode !== 204)) {
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

  function makePoolRequests () {
    logger.info('Making pool requests to friends.')

    PoolRequests.list(function (err, pool_requests) {
      if (err) {
        logger.error('Cannot get the list of pool requests.', { err: err })
        return // Abort
      }

      if (pool_requests.length === 0) return

      var requests_to_make = {
        add: {
          ids: [],
          requests: []
        },
        remove: {
          ids: [],
          requests: []
        }
      }

      async.each(pool_requests, function (pool_request, callback_each) {
        if (pool_request.type === 'add') {
          requests_to_make.add.requests.push(pool_request.request)
          requests_to_make.add.ids.push(pool_request._id)
        } else if (pool_request.type === 'remove') {
          requests_to_make.remove.requests.push(pool_request.request)
          requests_to_make.remove.ids.push(pool_request._id)
        } else {
          logger.error('Unkown pool request type.', { request_type: pool_request.type })
          return // abort
        }

        callback_each()
      }, function () {
        // Send the add requests
        if (requests_to_make.add.requests.length !== 0) {
          makePoolRequest('add', requests_to_make.add.requests, function (err) {
            if (err) logger.error('Errors when sent add pool requests.', { error: err })

            PoolRequests.removeRequests(requests_to_make.add.ids)
          })
        }

        // Send the remove requests
        if (requests_to_make.remove.requests.length !== 0) {
          makePoolRequest('remove', requests_to_make.remove.requests, function (err) {
            if (err) logger.error('Errors when sent remove pool requests.', { error: err })

            PoolRequests.removeRequests(requests_to_make.remove.ids)
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

      var urls = pluck(pods, 'url')
      var ids = pluck(pods, '_id')

      Videos.removeAllRemotesOf(urls, function (err, r) {
        if (err) {
          logger.error('Cannot remove videos from a pod that we removing.', { error: err })
        } else {
          var videos_removed = r.result.n
          logger.info('Removed %d videos.', videos_removed)
        }

        Pods.removeAllByIds(ids, function (err, r) {
          if (err) {
            logger.error('Cannot remove bad pods.', { error: err })
          } else {
            var pods_removed = r.result.n
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
})()
