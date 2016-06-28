'use strict'

const async = require('async')
const config = require('config')
const fs = require('fs')
const mongoose = require('mongoose')
const request = require('request')

const constants = require('../initializers/constants')
const logger = require('../helpers/logger')
const peertubeCrypto = require('../helpers/peertubeCrypto')
const Pods = require('../models/pods')
const requests = require('../helpers/requests')

const http = config.get('webserver.https') ? 'https' : 'http'
const host = config.get('webserver.host')
const port = config.get('webserver.port')
const Request = mongoose.model('Request')
const Video = mongoose.model('Video')

const pods = {
  addVideoToFriends: addVideoToFriends,
  hasFriends: hasFriends,
  getMyCertificate: getMyCertificate,
  makeFriends: makeFriends,
  quitFriends: quitFriends,
  removeVideoToFriends: removeVideoToFriends,
  sendOwnedVideosToPod: sendOwnedVideosToPod
}

function addVideoToFriends (video) {
  createRequest('add', video)
}

function hasFriends (callback) {
  Pods.count(function (err, count) {
    if (err) return callback(err)

    const hasFriends = (count !== 0)
    callback(null, hasFriends)
  })
}

function getMyCertificate (callback) {
  fs.readFile(peertubeCrypto.getCertDir() + 'peertube.pub', 'utf8', callback)
}

function makeFriends (callback) {
  const podsScore = {}

  logger.info('Make friends!')
  getMyCertificate(function (err, cert) {
    if (err) {
      logger.error('Cannot read public cert.')
      return callback(err)
    }

    const urls = config.get('network.friends')

    async.eachSeries(urls, function (url, callbackEach) {
      computeForeignPodsList(url, podsScore, callbackEach)
    }, function (err) {
      if (err) return callback(err)

      logger.debug('Pods scores computed.', { podsScore: podsScore })
      const podsList = computeWinningPods(urls, podsScore)
      logger.debug('Pods that we keep.', { podsToKeep: podsList })

      makeRequestsToWinningPods(cert, podsList, callback)
    })
  })
}

function quitFriends (callback) {
  // Stop pool requests
  Request.deactivate()
  // Flush pool requests
  Request.flush()

  async.waterfall([
    function getPodsList (callbackAsync) {
      return Pods.list(callbackAsync)
    },

    function announceIQuitMyFriends (pods, callbackAsync) {
      const requestParams = {
        method: 'POST',
        path: '/api/' + constants.API_VERSION + '/pods/remove',
        sign: true
      }

      // Announce we quit them
      // We don't care if the request fails
      // The other pod will exclude us automatically after a while
      async.eachLimit(pods, constants.REQUESTS_IN_PARALLEL, function (pod, callbackEach) {
        requestParams.toPod = pod
        requests.makeSecureRequest(requestParams, callbackEach)
      }, function (err) {
        if (err) {
          logger.error('Some errors while quitting friends.', { err: err })
          // Don't stop the process
        }

        return callbackAsync()
      })
    },

    function removePodsFromDB (callbackAsync) {
      Pods.removeAll(function (err) {
        return callbackAsync(err)
      })
    },

    function listRemoteVideos (callbackAsync) {
      logger.info('Broke friends, so sad :(')

      Video.listRemotes(callbackAsync)
    },

    function removeTheRemoteVideos (videosList, callbackAsync) {
      async.each(videosList, function (video, callbackEach) {
        video.remove(callbackEach)
      }, callbackAsync)
    }
  ], function (err) {
    // Don't forget to re activate the scheduler, even if there was an error
    Request.activate()

    if (err) return callback(err)

    logger.info('Removed all remote videos.')
    return callback(null)
  })
}

function removeVideoToFriends (videoParams) {
  createRequest('remove', videoParams)
}

function sendOwnedVideosToPod (podId) {
  Video.listOwned(function (err, videosList) {
    if (err) {
      logger.error('Cannot get the list of videos we own.')
      return
    }

    videosList.forEach(function (video) {
      video.toRemoteJSON(function (err, remoteVideo) {
        if (err) {
          logger.error('Cannot convert video to remote.', { error: err })
          // Don't break the process
          return
        }

        createRequest('add', remoteVideo, [ podId ])
      })
    })
  })
}

// ---------------------------------------------------------------------------

module.exports = pods

// ---------------------------------------------------------------------------

function computeForeignPodsList (url, podsScore, callback) {
  getForeignPodsList(url, function (err, foreignPodsList) {
    if (err) return callback(err)

    if (!foreignPodsList) foreignPodsList = []

    // Let's give 1 point to the pod we ask the friends list
    foreignPodsList.push({ url: url })

    foreignPodsList.forEach(function (foreignPod) {
      const foreignPodUrl = foreignPod.url

      if (podsScore[foreignPodUrl]) podsScore[foreignPodUrl]++
      else podsScore[foreignPodUrl] = 1
    })

    callback()
  })
}

function computeWinningPods (urls, podsScore) {
  // Build the list of pods to add
  // Only add a pod if it exists in more than a half base pods
  const podsList = []
  const baseScore = urls.length / 2
  Object.keys(podsScore).forEach(function (pod) {
    if (podsScore[pod] > baseScore) podsList.push({ url: pod })
  })

  return podsList
}

function getForeignPodsList (url, callback) {
  const path = '/api/' + constants.API_VERSION + '/pods'

  request.get(url + path, function (err, response, body) {
    if (err) return callback(err)

    callback(null, JSON.parse(body))
  })
}

function makeRequestsToWinningPods (cert, podsList, callback) {
  // Stop pool requests
  Request.deactivate()
  // Flush pool requests
  Request.forceSend()

  async.eachLimit(podsList, constants.REQUESTS_IN_PARALLEL, function (pod, callbackEach) {
    const params = {
      url: pod.url + '/api/' + constants.API_VERSION + '/pods/',
      method: 'POST',
      json: {
        url: http + '://' + host + ':' + port,
        publicKey: cert
      }
    }

    requests.makeRetryRequest(params, function (err, res, body) {
      if (err) {
        logger.error('Error with adding %s pod.', pod.url, { error: err })
        // Don't break the process
        return callbackEach()
      }

      if (res.statusCode === 200) {
        Pods.add({ url: pod.url, publicKey: body.cert, score: constants.FRIEND_BASE_SCORE }, function (err, podCreated) {
          if (err) logger.error('Cannot add friend %s pod.', pod.url)

          // Add our videos to the request scheduler
          sendOwnedVideosToPod(podCreated._id)

          return callbackEach()
        })
      } else {
        logger.error('Status not 200 for %s pod.', pod.url)
        return callbackEach()
      }
    })
  }, function endRequests () {
    // Final callback, we've ended all the requests
    // Now we made new friends, we can re activate the pool of requests
    Request.activate()

    logger.debug('makeRequestsToWinningPods finished.')
    return callback()
  })
}

function createRequest (type, data, to) {
  const req = new Request({
    request: {
      type: type,
      data: data
    }
  })

  if (to) {
    req.to = to
  }

  req.save(function (err) {
    if (err) logger.error('Cannot save the request.', { error: err })
  })
}
