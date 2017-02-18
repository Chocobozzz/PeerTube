'use strict'

const each = require('async/each')
const eachLimit = require('async/eachLimit')
const eachSeries = require('async/eachSeries')
const request = require('request')
const waterfall = require('async/waterfall')

const constants = require('../initializers/constants')
const db = require('../initializers/database')
const logger = require('../helpers/logger')
const peertubeCrypto = require('../helpers/peertube-crypto')
const requests = require('../helpers/requests')
const RequestScheduler = require('./request-scheduler')

const ENDPOINT_ACTIONS = constants.REQUEST_ENDPOINT_ACTIONS[constants.REQUEST_ENDPOINTS.VIDEOS]
const requestScheduler = new RequestScheduler()

const friends = {
  activate,
  addVideoToFriends,
  updateVideoToFriends,
  reportAbuseVideoToFriend,
  hasFriends,
  makeFriends,
  quitFriends,
  removeVideoToFriends,
  sendOwnedVideosToPod
}

function activate () {
  requestScheduler.activate()
}

function addVideoToFriends (videoData, transaction, callback) {
  const options = {
    type: ENDPOINT_ACTIONS.ADD,
    endpoint: constants.REQUEST_ENDPOINTS.VIDEOS,
    data: videoData,
    transaction
  }
  createRequest(options, callback)
}

function updateVideoToFriends (videoData, transaction, callback) {
  const options = {
    type: ENDPOINT_ACTIONS.UPDATE,
    endpoint: constants.REQUEST_ENDPOINTS.VIDEOS,
    data: videoData,
    transaction
  }
  createRequest(options, callback)
}

function removeVideoToFriends (videoParams) {
  const options = {
    type: ENDPOINT_ACTIONS.REMOVE,
    endpoint: constants.REQUEST_ENDPOINTS.VIDEOS,
    data: videoParams
  }
  createRequest(options)
}

function reportAbuseVideoToFriend (reportData, video) {
  const options = {
    type: ENDPOINT_ACTIONS.REPORT_ABUSE,
    endpoint: constants.REQUEST_ENDPOINTS.VIDEOS,
    data: reportData,
    toIds: [ video.Author.podId ]
  }
  createRequest(options)
}

function hasFriends (callback) {
  db.Pod.countAll(function (err, count) {
    if (err) return callback(err)

    const hasFriends = (count !== 0)
    callback(null, hasFriends)
  })
}

function makeFriends (hosts, callback) {
  const podsScore = {}

  logger.info('Make friends!')
  peertubeCrypto.getMyPublicCert(function (err, cert) {
    if (err) {
      logger.error('Cannot read public cert.')
      return callback(err)
    }

    eachSeries(hosts, function (host, callbackEach) {
      computeForeignPodsList(host, podsScore, callbackEach)
    }, function (err) {
      if (err) return callback(err)

      logger.debug('Pods scores computed.', { podsScore: podsScore })
      const podsList = computeWinningPods(hosts, podsScore)
      logger.debug('Pods that we keep.', { podsToKeep: podsList })

      makeRequestsToWinningPods(cert, podsList, callback)
    })
  })
}

function quitFriends (callback) {
  // Stop pool requests
  requestScheduler.deactivate()

  waterfall([
    function flushRequests (callbackAsync) {
      requestScheduler.flush(callbackAsync)
    },

    function getPodsList (callbackAsync) {
      return db.Pod.list(callbackAsync)
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
      eachLimit(pods, constants.REQUESTS_IN_PARALLEL, function (pod, callbackEach) {
        requestParams.toPod = pod
        requests.makeSecureRequest(requestParams, callbackEach)
      }, function (err) {
        if (err) {
          logger.error('Some errors while quitting friends.', { err: err })
          // Don't stop the process
        }

        return callbackAsync(null, pods)
      })
    },

    function removePodsFromDB (pods, callbackAsync) {
      each(pods, function (pod, callbackEach) {
        pod.destroy().asCallback(callbackEach)
      }, callbackAsync)
    }
  ], function (err) {
    // Don't forget to re activate the scheduler, even if there was an error
    requestScheduler.activate()

    if (err) return callback(err)

    logger.info('Removed all remote videos.')
    return callback(null)
  })
}

function sendOwnedVideosToPod (podId) {
  db.Video.listOwnedAndPopulateAuthorAndTags(function (err, videosList) {
    if (err) {
      logger.error('Cannot get the list of videos we own.')
      return
    }

    videosList.forEach(function (video) {
      video.toAddRemoteJSON(function (err, remoteVideo) {
        if (err) {
          logger.error('Cannot convert video to remote.', { error: err })
          // Don't break the process
          return
        }

        const options = {
          type: 'add',
          endpoint: constants.REQUEST_ENDPOINTS.VIDEOS,
          data: remoteVideo,
          toIds: [ podId ]
        }
        createRequest(options)
      })
    })
  })
}

// ---------------------------------------------------------------------------

module.exports = friends

// ---------------------------------------------------------------------------

function computeForeignPodsList (host, podsScore, callback) {
  getForeignPodsList(host, function (err, res) {
    if (err) return callback(err)

    const foreignPodsList = res.data

    // Let's give 1 point to the pod we ask the friends list
    foreignPodsList.push({ host })

    foreignPodsList.forEach(function (foreignPod) {
      const foreignPodHost = foreignPod.host

      if (podsScore[foreignPodHost]) podsScore[foreignPodHost]++
      else podsScore[foreignPodHost] = 1
    })

    return callback()
  })
}

function computeWinningPods (hosts, podsScore) {
  // Build the list of pods to add
  // Only add a pod if it exists in more than a half base pods
  const podsList = []
  const baseScore = hosts.length / 2

  Object.keys(podsScore).forEach(function (podHost) {
    // If the pod is not me and with a good score we add it
    if (isMe(podHost) === false && podsScore[podHost] > baseScore) {
      podsList.push({ host: podHost })
    }
  })

  return podsList
}

function getForeignPodsList (host, callback) {
  const path = '/api/' + constants.API_VERSION + '/pods'

  request.get(constants.REMOTE_SCHEME.HTTP + '://' + host + path, function (err, response, body) {
    if (err) return callback(err)

    try {
      const json = JSON.parse(body)
      return callback(null, json)
    } catch (err) {
      return callback(err)
    }
  })
}

function makeRequestsToWinningPods (cert, podsList, callback) {
  // Stop pool requests
  requestScheduler.deactivate()
  // Flush pool requests
  requestScheduler.forceSend()

  eachLimit(podsList, constants.REQUESTS_IN_PARALLEL, function (pod, callbackEach) {
    const params = {
      url: constants.REMOTE_SCHEME.HTTP + '://' + pod.host + '/api/' + constants.API_VERSION + '/pods/',
      method: 'POST',
      json: {
        host: constants.CONFIG.WEBSERVER.HOST,
        email: constants.CONFIG.ADMIN.EMAIL,
        publicKey: cert
      }
    }

    requests.makeRetryRequest(params, function (err, res, body) {
      if (err) {
        logger.error('Error with adding %s pod.', pod.host, { error: err })
        // Don't break the process
        return callbackEach()
      }

      if (res.statusCode === 200) {
        const podObj = db.Pod.build({ host: pod.host, publicKey: body.cert, email: body.email })
        podObj.save().asCallback(function (err, podCreated) {
          if (err) {
            logger.error('Cannot add friend %s pod.', pod.host, { error: err })
            return callbackEach()
          }

          // Add our videos to the request scheduler
          sendOwnedVideosToPod(podCreated.id)

          return callbackEach()
        })
      } else {
        logger.error('Status not 200 for %s pod.', pod.host)
        return callbackEach()
      }
    })
  }, function endRequests () {
    // Final callback, we've ended all the requests
    // Now we made new friends, we can re activate the pool of requests
    requestScheduler.activate()

    logger.debug('makeRequestsToWinningPods finished.')
    return callback()
  })
}

// Wrapper that populate "toIds" argument with all our friends if it is not specified
// { type, endpoint, data, toIds, transaction }
function createRequest (options, callback) {
  if (!callback) callback = function () {}
  if (options.toIds) return requestScheduler.createRequest(options, callback)

  // If the "toIds" pods is not specified, we send the request to all our friends
  db.Pod.listAllIds(options.transaction, function (err, podIds) {
    if (err) {
      logger.error('Cannot get pod ids', { error: err })
      return
    }

    const newOptions = Object.assign(options, { toIds: podIds })
    return requestScheduler.createRequest(newOptions, callback)
  })
}

function isMe (host) {
  return host === constants.CONFIG.WEBSERVER.HOST
}
