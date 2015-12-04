;(function () {
  'use strict'

  var async = require('async')

  var logger = require('./logger')
  var database = require('./database')
  var PoolRequestsDB = database.PoolRequestsDB
  var PodsDB = database.PodsDB
  var utils = require('./utils')

  var poolRequests = {}

  // ----------- Constants -----------

  // Time to wait between requests to the friends
  var INTERVAL = utils.isTestInstance() ? 10000 : 60000
  var PODS_SCORE = {
    MALUS: -10,
    BONUS: 10
  }

  // ----------- Private -----------
  var timer = null

  function makePoolRequests () {
    logger.info('Making pool requests to friends.')

    PoolRequestsDB.find({}, { type: 1, request: 1 }, function (err, pool_requests) {
      if (err) throw err

      if (pool_requests.length === 0) return

      var requests = {
        add: [],
        remove: []
      }

      async.each(pool_requests, function (pool_request, callback_each) {
        if (pool_request.type === 'add') {
          requests.add.push(pool_request.request)
        } else if (pool_request.type === 'remove') {
          requests.remove.push(pool_request.request)
        } else {
          throw new Error('Unkown pool request type.')
        }

        callback_each()
      }, function () {
        makePoolRequest('add', requests.add)
        makePoolRequest('remove', requests.remove)
        logger.info('Pool requests to friends sent.')
      })
    })
  }

  function updatePodsScore (good_pods, bad_pods) {
    logger.info('Updating %d good pods and %d bad pods scores.', good_pods.length, bad_pods.length)

    PodsDB.update({ _id: { $in: good_pods } }, { $inc: { score: PODS_SCORE.BONUS } }, { multi: true }).exec()
    PodsDB.update({ _id: { $in: bad_pods } }, { $inc: { score: PODS_SCORE.MALUS } }, { multi: true }, function (err) {
      if (err) throw err
      removeBadPods()
    })
  }

  function removeBadPods () {
    PodsDB.remove({ score: 0 }, function (err, result) {
      if (err) throw err

      var number_removed = result.result.n
      if (number_removed !== 0) logger.info('Removed %d pod.', number_removed)
    })
  }

  function makePoolRequest (type, requests) {
    logger.debug('Make pool requests scheduled.')
    PodsDB.find({}, { _id: 1, url: 1, publicKey: 1 }).exec(function (err, pods) {
      if (err) throw err

      var params = {
        encrypt: true,
        sign: true,
        method: 'POST',
        path: null,
        data: requests
      }

      if (type === 'add') {
        params.path = '/api/' + global.API_VERSION + '/remotevideos/add'
      } else if (type === 'remove') {
        params.path = '/api/' + global.API_VERSION + '/remotevideos/remove'
      } else {
        throw new Error('Unkown pool request type.')
      }

      var bad_pods = []
      var good_pods = []

      utils.makeMultipleRetryRequest(params, pods, callbackEachPodFinished, callbackAllPodsFinished)

      function callbackEachPodFinished (err, response, body, url, pod, callback_each_pod_finished) {
        if (err || response.statusCode !== 200) {
          bad_pods.push(pod._id)
          logger.error('Error sending secure request to %s pod.', url, { error: err })
        } else {
          good_pods.push(pod._id)
        }

        return callback_each_pod_finished()
      }

      function callbackAllPodsFinished (err) {
        if (err) {
          logger.error('There was some errors when sending the video meta data.', { error: err })
        }

        updatePodsScore(good_pods, bad_pods)
        PoolRequestsDB.remove().exec()
      }
    })
  }

  // ----------- Public -----------
  poolRequests.activate = function () {
    logger.info('Pool requests activated.')
    timer = setInterval(makePoolRequests, INTERVAL)
  }

  poolRequests.addToPoolRequests = function (id, type, request) {
    logger.debug('Add request to the pool requests.', { id: id, type: type, request: request })

    PoolRequestsDB.findOne({ id: id }, function (err, entity) {
      if (err) logger.error(err)

      if (entity) {
        if (entity.type === type) {
          logger.error(new Error('Cannot insert two same requests.'))
          return
        }

        // Remove the request of the other type
        PoolRequestsDB.remove({ id: id }, function (err) {
          if (err) logger.error(err)
        })
      } else {
        PoolRequestsDB.create({ id: id, type: type, request: request }, function (err) {
          if (err) logger.error(err)
        })
      }
    })
  }

  poolRequests.deactivate = function () {
    logger.info('Pool requests deactivated.')
    clearInterval(timer)
  }

  module.exports = poolRequests
})()
