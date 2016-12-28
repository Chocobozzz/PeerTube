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
  const RequestToPod = this.sequelize.models.RequestToPod

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

    requests.forEach(function (request) {
      request.Pods.forEach(function (toPod) {
        const hashKey = toPod.id + request.endpoint
        if (!requestsToMakeGrouped[hashKey]) {
          requestsToMakeGrouped[hashKey] = {
            toPodId: toPod.id,
            endpoint: request.endpoint,
            ids: [], // request ids, to delete them from the DB in the future
            datas: [] // requests data,
          }
        }

        requestsToMakeGrouped[hashKey].ids.push(request.id)
        requestsToMakeGrouped[hashKey].datas.push(request.request)
      })
    })

    const goodPods = []
    const badPods = []

    eachLimit(Object.keys(requestsToMakeGrouped), constants.REQUESTS_IN_PARALLEL, function (hashKey, callbackEach) {
      const requestToMake = requestsToMakeGrouped[hashKey]

      // FIXME: SQL request inside a loop :/
      self.sequelize.models.Pod.load(requestToMake.toPodId, function (err, toPod) {
        if (err) {
          logger.error('Error finding pod by id.', { err: err })
          return callbackEach()
        }

        // Maybe the pod is not our friend anymore so simply remove it
        if (!toPod) {
          const requestIdsToDelete = requestToMake.ids

          logger.info('Removing %d requests of unexisting pod %s.', requestIdsToDelete.length, requestToMake.toPodId)
          RequestToPod.removePodOf.call(self, requestIdsToDelete, requestToMake.toPodId)
          return callbackEach()
        }

        makeRequest(toPod, requestToMake.endpoint, requestToMake.datas, function (success) {
          if (success === true) {
            logger.debug('Removing requests for pod %s.', requestToMake.toPodId, { requestsIds: requestToMake.ids })

            goodPods.push(requestToMake.toPodId)

            // Remove the pod id of these request ids
            RequestToPod.removePodOf(requestToMake.ids, requestToMake.toPodId, callbackEach)
          } else {
            badPods.push(requestToMake.toPodId)
            callbackEach()
          }
        })
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

function listWithLimitAndRandom (limit, callback) {
  const self = this

  self.count().asCallback(function (err, count) {
    if (err) return callback(err)

    // Optimization...
    if (count === 0) return callback(null, [])

    let start = Math.floor(Math.random() * count) - limit
    if (start < 0) start = 0

    const query = {
      order: [
        [ 'id', 'ASC' ]
      ],
      offset: start,
      limit: limit,
      include: [ this.sequelize.models.Pod ]
    }

    self.findAll(query).asCallback(callback)
  })
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
