'use strict'

const each = require('async/each')
const eachLimit = require('async/eachLimit')
const values = require('lodash/values')
const mongoose = require('mongoose')
const waterfall = require('async/waterfall')

const constants = require('../initializers/constants')
const logger = require('../helpers/logger')
const requests = require('../helpers/requests')

const Pod = mongoose.model('Pod')

let timer = null
let lastRequestTimestamp = 0

// ---------------------------------------------------------------------------

const RequestSchema = mongoose.Schema({
  request: mongoose.Schema.Types.Mixed,
  endpoint: {
    type: String,
    enum: [ values(constants.REQUEST_ENDPOINTS) ]
  },
  to: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Pod'
    }
  ]
})

RequestSchema.statics = {
  activate,
  deactivate,
  flush,
  forceSend,
  list,
  remainingMilliSeconds
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
  lastRequestTimestamp = Date.now()

  const self = this
  timer = setInterval(function () {
    lastRequestTimestamp = Date.now()
    makeRequests.call(self)
  }, constants.REQUESTS_INTERVAL)
}

function deactivate () {
  logger.info('Requests scheduler deactivated.')
  clearInterval(timer)
  timer = null
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

function list (callback) {
  this.find({ }, callback)
}

function remainingMilliSeconds () {
  if (timer === null) return -1

  return constants.REQUESTS_INTERVAL - (Date.now() - lastRequestTimestamp)
}

// ---------------------------------------------------------------------------

// Make a requests to friends of a certain type
function makeRequest (toPod, requestEndpoint, requestsToMake, callback) {
  if (!callback) callback = function () {}

  const params = {
    toPod: toPod,
    sign: true, // Prove our identity
    method: 'POST',
    path: '/api/' + constants.API_VERSION + '/remote/' + requestEndpoint,
    data: requestsToMake // Requests we need to make
  }

  // Make multiple retry requests to all of pods
  // The function fire some useful callbacks
  requests.makeSecureRequest(params, function (err, res) {
    if (err || (res.statusCode !== 200 && res.statusCode !== 201 && res.statusCode !== 204)) {
      logger.error(
        'Error sending secure request to %s pod.',
        toPod.host,
        {
          error: err || new Error('Status code not 20x : ' + res.statusCode)
        }
      )

      return callback(false)
    }

    return callback(true)
  })
}

// Make all the requests of the scheduler
function makeRequests () {
  const self = this

  // We limit the size of the requests (REQUESTS_LIMIT)
  // We don't want to stuck with the same failing requests so we get a random list
  listWithLimitAndRandom.call(self, constants.REQUESTS_LIMIT, function (err, requests) {
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

    // We want to group requests by destinations pod and endpoint
    const requestsToMakeGrouped = {}

    requests.forEach(function (poolRequest) {
      poolRequest.to.forEach(function (toPodId) {
        const hashKey = toPodId + poolRequest.endpoint
        if (!requestsToMakeGrouped[hashKey]) {
          requestsToMakeGrouped[hashKey] = {
            toPodId,
            endpoint: poolRequest.endpoint,
            ids: [], // pool request ids, to delete them from the DB in the future
            datas: [] // requests data,
          }
        }

        requestsToMakeGrouped[hashKey].ids.push(poolRequest._id)
        requestsToMakeGrouped[hashKey].datas.push(poolRequest.request)
      })
    })

    const goodPods = []
    const badPods = []

    eachLimit(Object.keys(requestsToMakeGrouped), constants.REQUESTS_IN_PARALLEL, function (hashKey, callbackEach) {
      const requestToMake = requestsToMakeGrouped[hashKey]

      // FIXME: mongodb request inside a loop :/
      Pod.load(requestToMake.toPodId, function (err, toPod) {
        if (err) {
          logger.error('Error finding pod by id.', { err: err })
          return callbackEach()
        }

        // Maybe the pod is not our friend anymore so simply remove it
        if (!toPod) {
          const requestIdsToDelete = requestToMake.ids

          logger.info('Removing %d requests of unexisting pod %s.', requestIdsToDelete.length, requestToMake.toPodId)
          removePodOf.call(self, requestIdsToDelete, requestToMake.toPodId)
          return callbackEach()
        }

        makeRequest(toPod, requestToMake.endpoint, requestToMake.datas, function (success) {
          if (success === true) {
            logger.debug('Removing requests for %s pod.', requestToMake.toPodId, { requestsIds: requestToMake.ids })

            goodPods.push(requestToMake.toPodId)

            // Remove the pod id of these request ids
            removePodOf.call(self, requestToMake.ids, requestToMake.toPodId, callbackEach)
          } else {
            badPods.push(requestToMake.toPodId)
            callbackEach()
          }
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
  waterfall([
    function findBadPods (callback) {
      Pod.listBadPods(function (err, pods) {
        if (err) {
          logger.error('Cannot find bad pods.', { error: err })
          return callback(err)
        }

        return callback(null, pods)
      })
    },

    function removeTheseBadPods (pods, callback) {
      if (pods.length === 0) return callback(null, 0)

      each(pods, function (pod, callbackEach) {
        pod.remove(callbackEach)
      }, function (err) {
        return callback(err, pods.length)
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

function listWithLimitAndRandom (limit, callback) {
  const self = this

  self.count(function (err, count) {
    if (err) return callback(err)

    let start = Math.floor(Math.random() * count) - limit
    if (start < 0) start = 0

    self.find().sort({ _id: 1 }).skip(start).limit(limit).exec(callback)
  })
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
