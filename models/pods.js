;(function () {
  'use strict'

  var async = require('async')
  var config = require('config')
  var fs = require('fs')
  var request = require('request')

  var constants = require('../initializers/constants')
  var logger = require('../helpers/logger')
  var PodsDB = require('../initializers/database').PodsDB
  var poolRequests = require('../lib/poolRequests')
  var utils = require('../helpers/utils')

  var pods = {}

  var http = config.get('webserver.https') ? 'https' : 'http'
  var host = config.get('webserver.host')
  var port = config.get('webserver.port')

  // ----------- Private functions -----------

  function getForeignPodsList (url, callback) {
    var path = '/api/' + constants.API_VERSION + '/pods'

    request.get(url + path, function (err, response, body) {
      if (err) throw err
      callback(JSON.parse(body))
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
  // TODO: check if the pod is not already a friend
  pods.add = function (data, callback) {
    var videos = require('./videos')
    logger.info('Adding pod: %s', data.url)

    var params = {
      url: data.url,
      publicKey: data.publicKey,
      score: constants.FRIEND_BASE_SCORE
    }

    PodsDB.create(params, function (err, pod) {
      if (err) {
        logger.error('Cannot insert the pod.', { error: err })
        return callback(err)
      }

      videos.addRemotes(data.videos)

      fs.readFile(utils.certDir + 'peertube.pub', 'utf8', function (err, cert) {
        if (err) {
          logger.error('Cannot read cert file.', { error: err })
          return callback(err)
        }

        videos.listOwned(function (err, videos_list) {
          if (err) {
            logger.error('Cannot get the list of owned videos.', { error: err })
            return callback(err)
          }

          return callback(null, { cert: cert, videos: videos_list })
        })
      })
    })
  }

  pods.remove = function (url, callback) {
    var videos = require('./videos')
    logger.info('Removing %s pod.', url)

    videos.removeAllRemotesOf(url, function (err) {
      if (err) logger.error('Cannot remove all remote videos of %s.', url)

      PodsDB.remove({ url: url }, function (err) {
        if (err) return callback(err)

        logger.info('%s pod removed.', url)
        callback(null)
      })
    })
  }

  pods.addVideoToFriends = function (video) {
    // To avoid duplicates
    var id = video.name + video.magnetUri
    poolRequests.addToPoolRequests(id, 'add', video)
  }

  pods.removeVideoToFriends = function (video) {
    // To avoid duplicates
    var id = video.name + video.magnetUri
    poolRequests.addToPoolRequests(id, 'remove', video)
  }

  pods.makeFriends = function (callback) {
    var videos = require('./videos')
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
      // Stop pool requests
      poolRequests.deactivate()
      // Flush pool requests
      poolRequests.forceSend()

      // Get the list of our videos to send to our new friends
      videos.listOwned(function (err, videos_list) {
        if (err) throw err

        var data = {
          url: http + '://' + host + ':' + port,
          publicKey: cert,
          videos: videos_list
        }

        utils.makeMultipleRetryRequest(
          { method: 'POST', path: '/api/' + constants.API_VERSION + '/pods/', data: data },

          pods_list,

          function eachRequest (err, response, body, url, pod, callback_each_request) {
            // We add the pod if it responded correctly with its public certificate
            if (!err && response.statusCode === 200) {
              pods.add({ url: pod.url, publicKey: body.cert, score: constants.FRIEND_BASE_SCORE }, function (err) {
                if (err) logger.error('Error with adding %s pod.', pod.url, { error: err })

                videos.addRemotes(body.videos, function (err) {
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
              logger.error('There was some errors when we wanted to make friends.', { error: err })
              return callback(err)
            }

            logger.debug('makeRequestsToWinningPods finished.')
            return callback(null)
          }
        )
      })
    }
  }

  pods.quitFriends = function (callback) {
    // Stop pool requests
    poolRequests.deactivate()
    // Flush pool requests
    poolRequests.forceSend()

    PodsDB.find(function (err, pods) {
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
      utils.makeMultipleRetryRequest(request, pods, function () {
        PodsDB.remove(function (err) {
          poolRequests.activate()

          if (err) return callback(err)

          logger.info('Broke friends, so sad :(')

          var videos = require('./videos')
          videos.removeAllRemotes(function (err) {
            if (err) return callback(err)

            logger.info('Removed all remote videos.')
            callback(null)
          })
        })
      })
    })
  }

  pods.hasFriends = function (callback) {
    PodsDB.count(function (err, count) {
      if (err) return callback(err)

      var has_friends = (count !== 0)
      callback(null, has_friends)
    })
  }

  module.exports = pods
})()
