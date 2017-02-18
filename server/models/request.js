'use strict'

const each = require('async/each')
const waterfall = require('async/waterfall')
const values = require('lodash/values')

const constants = require('../initializers/constants')
const logger = require('../helpers/logger')

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

        listWithLimitAndRandom,

        countTotalRequests,
        removeBadPods,
        updatePodsScore,
        removeAll,
        removeWithEmptyTo
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

function countTotalRequests (callback) {
  const query = {
    include: [ this.sequelize.models.Pod ]
  }

  return this.count(query).asCallback(callback)
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

// ---------------------------------------------------------------------------

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
