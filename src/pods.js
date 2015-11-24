;(function () {
  'use strict'

  var async = require('async')
  var config = require('config')
  var fs = require('fs')
  var request = require('request')

  var logger = require('./logger')
  var PodsDB = require('./database').PodsDB
  var utils = require('./utils')

  var pods = {}

  var http = config.get('webserver.https') ? 'https' : 'http'
  var host = config.get('webserver.host')
  var port = config.get('webserver.port')

  // ----------- Constants -----------

  var PODS_SCORE = {
    MALUS: -10,
    BONUS: 10
  }

  // ----------- Private functions -----------

  function getForeignPodsList (url, callback) {
    var path = '/api/' + global.API_VERSION + '/pods'

    request.get(url + path, function (err, response, body) {
      if (err) throw err
      callback(JSON.parse(body))
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

  // ----------- Public functions -----------

  pods.list = function (callback) {
    PodsDB.find(function (err, pods_list) {
      if (err) {
        logger.error('Cannot get the list of the pods.', { error: err })
        return callback(err)
      }

      return callback(null, pods_list)
    })
  }

  // { url }
  pods.add = function (data, callback) {
    logger.info('Adding pod: %s', data.url)

    var params = {
      url: data.url,
      publicKey: data.publicKey,
      score: global.FRIEND_BASE_SCORE
    }

    PodsDB.create(params, function (err, pod) {
      if (err) {
        logger.error('Cannot insert the pod.', { error: err })
        return callback(err)
      }

      fs.readFile(utils.certDir + 'peertube.pub', 'utf8', function (err, cert) {
        if (err) {
          logger.error('Cannot read cert file.', { error: err })
          return callback(err)
        }

        return callback(null, { cert: cert })
      })
    })
  }

  // { path, data }
  pods.makeSecureRequest = function (data, callback) {
    if (callback === undefined) callback = function () {}

    PodsDB.find({}, { _id: 1, url: 1, publicKey: 1 }).exec(function (err, pods) {
      if (err) {
        logger.error('Cannot get the list of the pods.', { error: err })
        return callback(err)
      }

      logger.debug('Make multiple requests.')

      var params = {
        encrypt: true,
        sign: true,
        method: data.method,
        path: data.path,
        data: data.data
      }

      var bad_pods = []
      var good_pods = []

      utils.makeMultipleRetryRequest(
        params,

        pods,

        function callbackEachPodFinished (err, response, body, pod, callback_each_pod_finished) {
          if (err || response.statusCode !== 200) {
            bad_pods.push(pod._id)
            logger.error('Error sending secure request to %s/%s pod.', pod.url, data.path, { error: err })
          } else {
            good_pods.push(pod._id)
          }

          return callback_each_pod_finished()
        },

        function callbackAllPodsFinished (err) {
          if (err) {
            logger.error('There was some errors when sending the video meta data.', { error: err })
            return callback(err)
          }

          logger.debug('Finished')

          updatePodsScore(good_pods, bad_pods)
          callback(null)
        }
      )
    })
  }

  pods.makeFriends = function (callback) {
    var pods_score = {}

    logger.info('Make friends!')
    fs.readFile(utils.certDir + 'peertube.pub', 'utf8', function (err, cert) {
      if (err) {
        logger.error('Cannot read public cert.', { error: err })
        return callback(err)
      }

      var urls = config.get('network.friends')

      async.each(urls, computeForeignPodsList, function () {
        logger.debug('Pods scores computed.', { pods_score: pods_score })
        var pods_list = computeWinningPods(urls, pods_score)
        logger.debug('Pods that we keep computed.', { pods_to_keep: pods_list })

        logger.debug('Make requests...')
        makeRequestsToWinningPods(cert, pods_list)
      })
    })

    // -----------------------------------------------------------------------

    function computeForeignPodsList (url, callback) {
      // Let's give 1 point to the pod we ask the friends list
      pods_score[url] = 1

      getForeignPodsList(url, function (foreign_pods_list) {
        if (foreign_pods_list.length === 0) return callback()

        async.each(foreign_pods_list, function (foreign_pod, callback_each) {
          var foreign_url = foreign_pod.url

          if (pods_score[foreign_url]) pods_score[foreign_url]++
          else pods_score[foreign_url] = 1

          callback_each()
        }, function () {
          callback()
        })
      })
    }

    function computeWinningPods (urls, pods_score) {
      // Build the list of pods to add
      // Only add a pod if it exists in more than a half base pods
      var pods_list = []
      var base_score = urls.length / 2
      Object.keys(pods_score).forEach(function (pod) {
        if (pods_score[pod] > base_score) pods_list.push({ url: pod })
      })

      return pods_list
    }

    function makeRequestsToWinningPods (cert, pods_list) {
      var data = {
        url: http + '://' + host + ':' + port,
        publicKey: cert
      }

      utils.makeMultipleRetryRequest(
        { method: 'POST', path: '/api/' + global.API_VERSION + '/pods/', data: data },

        pods_list,

        function eachRequest (err, response, body, pod, callback_each_request) {
          // We add the pod if it responded correctly with its public certificate
          if (!err && response.statusCode === 200) {
            pods.add({ url: pod.url, publicKey: body.cert, score: global.FRIEND_BASE_SCORE }, function (err) {
              if (err) {
                logger.error('Error with adding %s pod.', pod.url, { error: err })
              }

              return callback_each_request()
            })
          } else {
            logger.error('Error with adding %s pod.', pod.url, { error: err || new Error('Status not 200') })
            return callback_each_request()
          }
        },

        function endRequests (err) {
          if (err) {
            logger.error('There was some errors when we wanted to make friends.', { error: err })
            return callback(err)
          }

          logger.debug('makeRequestsToWinningPods finished.')
          return callback(null)
        }
      )
    }
  }

  module.exports = pods
})()
