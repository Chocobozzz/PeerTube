'use strict'

const values = require('lodash/values')

const constants = require('../initializers/constants')

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
  // We need to include Pod because there are no cascade delete when a pod is removed
  // So we could count requests that do not have existing pod anymore
  const query = {
    include: [ this.sequelize.models.Pod ]
  }

  return this.count(query).asCallback(callback)
}

function listWithLimitAndRandom (limitPods, limitRequestsPerPod, callback) {
  const self = this
  const Pod = this.sequelize.models.Pod

  Pod.listRandomPodIdsWithRequest(limitPods, 'RequestToPods', function (err, podIds) {
    if (err) return callback(err)

    // We don't have friends that have requests
    if (podIds.length === 0) return callback(null, [])

    // The first x requests of these pods
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
