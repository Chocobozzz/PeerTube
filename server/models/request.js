'use strict'

const each = require('async/each')
const eachLimit = require('async/eachLimit')
const waterfall = require('async/waterfall')
const values = require('lodash/values')

const constants = require('../initializers/constants')
const logger = require('../helpers/logger')
const requests = require('../helpers/requests')

let timer = null
let lastRequestTimestamp = 0

// ---------------------------------------------------------------------------

module.exports = function (sequelize, DataTypes) {
  const Request = sequelize.define('Request',
    {
      request: {
        type: DataTypes.JSON,
        allowNull: false
      },
      endpoint: {
        type: DataTypes.ENUM(values(constants.REQUEST_ENDPOINTS)),
        allowNull: false
      }
    },
    {
      classMethods: {
        associate,

        activate,
        countTotalRequests,
        deactivate,
        flush,
        forceSend,
        remainingMilliSeconds
      }
    }
  )

  return Request
}

// ------------------------------ STATICS ------------------------------

function associate (models) {
  this.belongsToMany(models.Pod, {
    foreignKey: {
      name: 'requestId',
      allowNull: false
    },
    through: models.RequestToPod,
    onDelete: 'CASCADE'
  })
}

function activate () {
  logger.info('Requests scheduler activated.')
  lastRequestTimestamp = Date.now()

  const self = this
  timer = setInterval(function () {
    lastRequestTimestamp = Date.now()
    makeRequests.call(self)
  }, constants.REQUESTS_INTERVAL)
}

function countTotalRequests (callback) {
  const query = {
    include: [ this.sequelize.models.Pod ]
  }

  return this.count(query).asCallback(callback)
}

function deactivate () {
  logger.info('Requests scheduler deactivated.')
  clearInterval(timer)
  timer = null
}

function flush (callback) {
  removeAll.call(this, function (err) {
    if (err) logger.error('Cannot flush the requests.', { error: err })

    return callback(err)
  })
}

function forceSend () {
  logger.info('Force requests scheduler sending.')
  makeRequests.call(this)
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
          error: err ? err.message : 'Status code not 20x : ' + res.statusCode
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
  const RequestToPod = this.sequelize.models.RequestToPod

  // We limit the size of the requests
  // We don't want to stuck with the same failing requests so we get a random list
  listWithLimitAndRandom.call(self, constants.REQUESTS_LIMIT_PODS, constants.REQUESTS_LIMIT_PER_POD, function (err, requests) {
    if (err) {
      logger.error('Cannot get the list of requests.', { err: err })
      return // Abort
    }

    // If there are no requests, abort
    if (requests.length === 0) {
      logger.info('No requests to make.')
      return
    }

    // We want to group requests by destinations pod and endpoint
    const requestsToMakeGrouped = {}
    Object.keys(requests).forEach(function (toPodId) {
      requests[toPodId].forEach(function (data) {
        const request = data.request
        const pod = data.pod
        const hashKey = toPodId + request.endpoint

        if (!requestsToMakeGrouped[hashKey]) {
          requestsToMakeGrouped[hashKey] = {
            toPod: pod,
            endpoint: request.endpoint,
            ids: [], // request ids, to delete them from the DB in the future
            datas: [] // requests data,
          }
        }

        requestsToMakeGrouped[hashKey].ids.push(request.id)
        requestsToMakeGrouped[hashKey].datas.push(request.request)
      })
    })

    logger.info('Making requests to friends.')

    const goodPods = []
    const badPods = []

    eachLimit(Object.keys(requestsToMakeGrouped), constants.REQUESTS_IN_PARALLEL, function (hashKey, callbackEach) {
      const requestToMake = requestsToMakeGrouped[hashKey]
      const toPod = requestToMake.toPod

      // Maybe the pod is not our friend anymore so simply remove it
      if (!toPod) {
        const requestIdsToDelete = requestToMake.ids

        logger.info('Removing %d requests of unexisting pod %s.', requestIdsToDelete.length, requestToMake.toPod.id)
        RequestToPod.removePodOf.call(self, requestIdsToDelete, requestToMake.toPod.id)
        return callbackEach()
      }

      makeRequest(toPod, requestToMake.endpoint, requestToMake.datas, function (success) {
        if (success === true) {
          logger.debug('Removing requests for pod %s.', requestToMake.toPod.id, { requestsIds: requestToMake.ids })

          goodPods.push(requestToMake.toPod.id)

          // Remove the pod id of these request ids
          RequestToPod.removePodOf(requestToMake.ids, requestToMake.toPod.id, callbackEach)
        } else {
          badPods.push(requestToMake.toPod.id)
          callbackEach()
        }
      })
    }, function () {
      // All the requests were made, we update the pods score
      updatePodsScore.call(self, goodPods, badPods)
      // Flush requests with no pod
      removeWithEmptyTo.call(self, function (err) {
        if (err) logger.error('Error when removing requests with no pods.', { error: err })
      })
    })
  })
}

// Remove pods with a score of 0 (too many requests where they were unreachable)
function removeBadPods () {
  const self = this

  waterfall([
    function findBadPods (callback) {
      self.sequelize.models.Pod.listBadPods(function (err, pods) {
        if (err) {
          logger.error('Cannot find bad pods.', { error: err })
          return callback(err)
        }

        return callback(null, pods)
      })
    },

    function removeTheseBadPods (pods, callback) {
      each(pods, function (pod, callbackEach) {
        pod.destroy().asCallback(callbackEach)
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
  const self = this
  const Pod = this.sequelize.models.Pod

  logger.info('Updating %d good pods and %d bad pods scores.', goodPods.length, badPods.length)

  if (goodPods.length !== 0) {
    Pod.incrementScores(goodPods, constants.PODS_SCORE.BONUS, function (err) {
      if (err) logger.error('Cannot increment scores of good pods.', { error: err })
    })
  }

  if (badPods.length !== 0) {
    Pod.incrementScores(badPods, constants.PODS_SCORE.MALUS, function (err) {
      if (err) logger.error('Cannot decrement scores of bad pods.', { error: err })
      removeBadPods.call(self)
    })
  }
}

function listWithLimitAndRandom (limitPods, limitRequestsPerPod, callback) {
  const self = this
  const Pod = this.sequelize.models.Pod

  Pod.listRandomPodIdsWithRequest(limitPods, function (err, podIds) {
    if (err) return callback(err)

    // We don't have friends that have requests
    if (podIds.length === 0) return callback(null, [])

    // The the first x requests of these pods
    // It is very important to sort by id ASC to keep the requests order!
    const query = {
      order: [
        [ 'id', 'ASC' ]
      ],
      include: [
        {
          model: self.sequelize.models.Pod,
          where: {
            id: {
              $in: podIds
            }
          }
        }
      ]
    }

    self.findAll(query).asCallback(function (err, requests) {
      if (err) return callback(err)

      const requestsGrouped = groupAndTruncateRequests(requests, limitRequestsPerPod)
      return callback(err, requestsGrouped)
    })
  })
}

function groupAndTruncateRequests (requests, limitRequestsPerPod) {
  const requestsGrouped = {}

  requests.forEach(function (request) {
    request.Pods.forEach(function (pod) {
      if (!requestsGrouped[pod.id]) requestsGrouped[pod.id] = []

      if (requestsGrouped[pod.id].length < limitRequestsPerPod) {
        requestsGrouped[pod.id].push({
          request,
          pod
        })
      }
    })
  })

  return requestsGrouped
}

function removeAll (callback) {
  // Delete all requests
  this.truncate({ cascade: true }).asCallback(callback)
}

function removeWithEmptyTo (callback) {
  if (!callback) callback = function () {}

  const query = {
    where: {
      id: {
        $notIn: [
          this.sequelize.literal('SELECT "requestId" FROM "RequestToPods"')
        ]
      }
    }
  }

  this.destroy(query).asCallback(callback)
}
