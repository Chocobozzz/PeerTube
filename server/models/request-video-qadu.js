'use strict'

/*
  Request Video for Quick And Dirty Updates like:
   - views
   - likes
   - dislikes

  We can't put it in the same system than basic requests for efficiency.
  Moreover we don't want to slow down the basic requests with a lot of views/likes/dislikes requests.
  So we put it an independant request scheduler.
*/

const values = require('lodash/values')

const constants = require('../initializers/constants')

// ---------------------------------------------------------------------------

module.exports = function (sequelize, DataTypes) {
  const RequestVideoQadu = sequelize.define('RequestVideoQadu',
    {
      type: {
        type: DataTypes.ENUM(values(constants.REQUEST_VIDEO_QADU_TYPES)),
        allowNull: false
      }
    },
    {
      timestamps: false,
      indexes: [
        {
          fields: [ 'podId' ]
        },
        {
          fields: [ 'videoId' ]
        }
      ],
      classMethods: {
        associate,

        listWithLimitAndRandom,

        countTotalRequests,
        removeAll,
        removeByRequestIdsAndPod
      }
    }
  )

  return RequestVideoQadu
}

// ------------------------------ STATICS ------------------------------

function associate (models) {
  this.belongsTo(models.Pod, {
    foreignKey: {
      name: 'podId',
      allowNull: false
    },
    onDelete: 'CASCADE'
  })

  this.belongsTo(models.Video, {
    foreignKey: {
      name: 'videoId',
      allowNull: false
    },
    onDelete: 'CASCADE'
  })
}

function countTotalRequests (callback) {
  const query = {
    include: [ this.sequelize.models.Pod ]
  }

  return this.count(query).asCallback(callback)
}

function listWithLimitAndRandom (limitPods, limitRequestsPerPod, callback) {
  const self = this
  const Pod = this.sequelize.models.Pod

  Pod.listRandomPodIdsWithRequest(limitPods, 'RequestVideoQadus', function (err, podIds) {
    if (err) return callback(err)

    // We don't have friends that have requests
    if (podIds.length === 0) return callback(null, [])

    const query = {
      include: [
        {
          model: self.sequelize.models.Pod,
          where: {
            id: {
              $in: podIds
            }
          }
        },
        {
          model: self.sequelize.models.Video
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

function removeByRequestIdsAndPod (ids, podId, callback) {
  const query = {
    where: {
      id: {
        $in: ids
      },
      podId
    }
  }

  this.destroy(query).asCallback(callback)
}

function removeAll (callback) {
  // Delete all requests
  this.truncate({ cascade: true }).asCallback(callback)
}

// ---------------------------------------------------------------------------

function groupAndTruncateRequests (requests, limitRequestsPerPod) {
  const requestsGrouped = {}

  requests.forEach(function (request) {
    const pod = request.Pod

    if (!requestsGrouped[pod.id]) requestsGrouped[pod.id] = []

    if (requestsGrouped[pod.id].length < limitRequestsPerPod) {
      requestsGrouped[pod.id].push({
        request: request,
        video: request.Video,
        pod
      })
    }
  })

  return requestsGrouped
}
