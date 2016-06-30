'use strict'

const async = require('async')
const map = require('lodash/map')
const mongoose = require('mongoose')

const constants = require('../initializers/constants')
const logger = require('../helpers/logger')
const requests = require('../helpers/requests')

const Pod = mongoose.model('Pod')
const Video = mongoose.model('Video')

let timer = null

// ---------------------------------------------------------------------------

const RequestSchema = mongoose.Schema({
  request: mongoose.Schema.Types.Mixed,
  to: [ { type: mongoose.Schema.Types.ObjectId, ref: 'users' } ]
})

RequestSchema.statics = {
  activate,
  deactivate,
  flush,
  forceSend
}

RequestSchema.pre('save', function (next) {
  const self = this

  if (self.to.length === 0) {
    Pod.listAllIds(function (err, podIds) {
      if (err) return next(err)

      // No friends
      if (podIds.length === 0) return

      self.to = podIds
      return next()
    })
  } else {
    return next()
  }
})

mongoose.model('Request', RequestSchema)

// ------------------------------ STATICS ------------------------------

function activate () {
  logger.info('Requests scheduler activated.')
  timer = setInterval(makeRequests.bind(this), constants.INTERVAL)
}

function deactivate () {
  logger.info('Requests scheduler deactivated.')
  clearInterval(timer)
}

function flush () {
  removeAll.call(this, function (err) {
    if (err) logger.error('Cannot flush the requests.', { error: err })
  })
}

function forceSend () {
  logger.info('Force requests scheduler sending.')
  makeRequests.call(this)
}

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
  const self = this

  list.call(self, function (err, requests) {
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
      Pod.load(toPodId, function (err, toPod) {
        if (err) {
          logger.error('Error finding pod by id.', { err: err })
          return callbackEach()
        }

        // Maybe the pod is not our friend anymore so simply remove them
        if (!toPod) {
          removePodOf.call(self, requestToMake.ids, toPodId)
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
            removePodOf.call(self, requestToMake.ids, toPodId)
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
      removeWithEmptyTo.call(self)
    })
  })
}

// Remove pods with a score of 0 (too many requests where they were unreachable)
function removeBadPods () {
  async.waterfall([
    function findBadPods (callback) {
      Pod.listBadPods(function (err, pods) {
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

      Video.listByUrls(urls, function (err, videosList) {
        if (err) {
          logger.error('Cannot list videos urls.', { error: err, urls: urls })
          return callback(null, pods, [])
        }

        return callback(null, pods, videosList)
      })
    },

    function removeVideosOfTheseBadPods (pods, videosList, callback) {
      // We don't have to remove pods, skip
      if (typeof pods === 'function') {
        callback = pods
        return callback(null)
      }

      async.each(videosList, function (video, callbackEach) {
        video.remove(callbackEach)
      }, function (err) {
        if (err) {
          // Don't stop the process
          logger.error('Error while removing videos of bad pods.', { error: err })
          return
        }

        return callback(null, pods)
      })
    },

    function removeBadPodsFromDB (pods, callback) {
      // We don't have to remove pods, skip
      if (typeof pods === 'function') {
        callback = pods
        return callback(null)
      }

      async.each(pods, function (pod, callbackEach) {
        pod.remove(callbackEach)
      }, function (err) {
        if (err) return callback(err)

        return callback(null, pods.length)
      })
    }
  ], function (err, numberOfPodsRemoved) {
    if (err) {
      logger.error('Cannot remove bad pods.', { error: err })
    } else if (numberOfPodsRemoved) {
      logger.info('Removed %d pods.', numberOfPodsRemoved)
    } else {
      logger.info('No need to remove bad pods.')
    }
  })
}

function updatePodsScore (goodPods, badPods) {
  logger.info('Updating %d good pods and %d bad pods scores.', goodPods.length, badPods.length)

  Pod.incrementScores(goodPods, constants.PODS_SCORE.BONUS, function (err) {
    if (err) logger.error('Cannot increment scores of good pods.')
  })

  Pod.incrementScores(badPods, constants.PODS_SCORE.MALUS, function (err) {
    if (err) logger.error('Cannot decrement scores of bad pods.')
    removeBadPods()
  })
}

function list (callback) {
  this.find({ }, { _id: 1, request: 1, to: 1 }, callback)
}

function removeAll (callback) {
  this.remove({ }, callback)
}

function removePodOf (requestsIds, podId, callback) {
  if (!callback) callback = function () {}

  this.update({ _id: { $in: requestsIds } }, { $pull: { to: podId } }, { multi: true }, callback)
}

function removeWithEmptyTo (callback) {
  if (!callback) callback = function () {}

  this.remove({ to: { $size: 0 } }, callback)
}
