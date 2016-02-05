;(function () {
  'use strict'

  var async = require('async')
  var config = require('config')
  var fs = require('fs')
  var request = require('request')

  var constants = require('../initializers/constants')
  var logger = require('../helpers/logger')
  var peertubeCrypto = require('../helpers/peertubeCrypto')
  var Pods = require('../models/pods')
  var PoolRequests = require('../models/poolRequests')
  var poolRequests = require('../lib/poolRequests')
  var requests = require('../helpers/requests')
  var Videos = require('../models/videos')

  var http = config.get('webserver.https') ? 'https' : 'http'
  var host = config.get('webserver.host')
  var port = config.get('webserver.port')

  var pods = {
    addVideoToFriends: addVideoToFriends,
    hasFriends: hasFriends,
    makeFriends: makeFriends,
    quitFriends: quitFriends,
    removeVideoToFriends: removeVideoToFriends
  }

  function addVideoToFriends (video) {
    // To avoid duplicates
    var id = video.name + video.magnetUri
    // ensure namePath is null
    video.namePath = null
    PoolRequests.addRequest(id, 'add', video)
  }

  function hasFriends (callback) {
    Pods.count(function (err, count) {
      if (err) return callback(err)

      var has_friends = (count !== 0)
      callback(null, has_friends)
    })
  }

  function makeFriends (callback) {
    var pods_score = {}

    logger.info('Make friends!')
    fs.readFile(peertubeCrypto.getCertDir() + 'peertube.pub', 'utf8', function (err, cert) {
      if (err) {
        logger.error('Cannot read public cert.')
        return callback(err)
      }

      var urls = config.get('network.friends')

      async.each(urls, computeForeignPodsList, function (err) {
        if (err) return callback(err)

        logger.debug('Pods scores computed.', { pods_score: pods_score })
        var pods_list = computeWinningPods(urls, pods_score)
        logger.debug('Pods that we keep computed.', { pods_to_keep: pods_list })

        makeRequestsToWinningPods(cert, pods_list)
      })
    })

    // -----------------------------------------------------------------------

    function computeForeignPodsList (url, callback) {
      // Let's give 1 point to the pod we ask the friends list
      pods_score[url] = 1

      getForeignPodsList(url, function (err, foreign_pods_list) {
        if (err) return callback(err)
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
      // Stop pool requests
      poolRequests.deactivate()
      // Flush pool requests
      poolRequests.forceSend()

      // Get the list of our videos to send to our new friends
      Videos.listOwned(function (err, videos_list) {
        if (err) {
          logger.error('Cannot get the list of videos we own.')
          return callback(err)
        }

        var data = {
          url: http + '://' + host + ':' + port,
          publicKey: cert,
          videos: videos_list
        }

        requests.makeMultipleRetryRequest(
          { method: 'POST', path: '/api/' + constants.API_VERSION + '/pods/', data: data },

          pods_list,

          function eachRequest (err, response, body, url, pod, callback_each_request) {
            // We add the pod if it responded correctly with its public certificate
            if (!err && response.statusCode === 200) {
              Pods.add({ url: pod.url, publicKey: body.cert, score: constants.FRIEND_BASE_SCORE }, function (err) {
                if (err) logger.error('Error with adding %s pod.', pod.url, { error: err })

                Videos.addRemotes(body.videos, function (err) {
                  if (err) logger.error('Error with adding videos of pod.', pod.url, { error: err })

                  logger.debug('Adding remote videos from %s.', pod.url, { videos: body.videos })
                  return callback_each_request()
                })
              })
            } else {
              logger.error('Error with adding %s pod.', pod.url, { error: err || new Error('Status not 200') })
              return callback_each_request()
            }
          },

          function endRequests (err) {
            // Now we made new friends, we can re activate the pool of requests
            poolRequests.activate()

            if (err) {
              logger.error('There was some errors when we wanted to make friends.')
              return callback(err)
            }

            logger.debug('makeRequestsToWinningPods finished.')
            return callback(null)
          }
        )
      })
    }
  }

  function quitFriends (callback) {
    // Stop pool requests
    poolRequests.deactivate()
    // Flush pool requests
    poolRequests.forceSend()

    Pods.list(function (err, pods) {
      if (err) return callback(err)

      var request = {
        method: 'POST',
        path: '/api/' + constants.API_VERSION + '/pods/remove',
        sign: true,
        encrypt: true,
        data: {
          url: 'me' // Fake data
        }
      }

      // Announce we quit them
      requests.makeMultipleRetryRequest(request, pods, function () {
        Pods.removeAll(function (err) {
          poolRequests.activate()

          if (err) return callback(err)

          logger.info('Broke friends, so sad :(')

          Videos.removeAllRemotes(function (err) {
            if (err) return callback(err)

            logger.info('Removed all remote videos.')
            callback(null)
          })
        })
      })
    })
  }

  function removeVideoToFriends (video) {
    // To avoid duplicates
    var id = video.name + video.magnetUri
    PoolRequests.addRequest(id, 'remove', video)
  }

  // ---------------------------------------------------------------------------

  module.exports = pods

  // ---------------------------------------------------------------------------

  function getForeignPodsList (url, callback) {
    var path = '/api/' + constants.API_VERSION + '/pods'

    request.get(url + path, function (err, response, body) {
      if (err) return callback(err)

      callback(null, JSON.parse(body))
    })
  }
})()
