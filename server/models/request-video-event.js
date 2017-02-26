'use strict'

/*
  Request Video events (likes, dislikes, views...)
*/

const values = require('lodash/values')

const constants = require('../initializers/constants')
const customVideosValidators = require('../helpers/custom-validators').videos

// ---------------------------------------------------------------------------

module.exports = function (sequelize, DataTypes) {
  const RequestVideoEvent = sequelize.define('RequestVideoEvent',
    {
      type: {
        type: DataTypes.ENUM(values(constants.REQUEST_VIDEO_EVENT_TYPES)),
        allowNull: false
      },
      count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
          countValid: function (value) {
            const res = customVideosValidators.isVideoEventCountValid(value)
            if (res === false) throw new Error('Video event count is not valid.')
          }
        }
      }
    },
    {
      updatedAt: false,
      indexes: [
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

  return RequestVideoEvent
}

// ------------------------------ STATICS ------------------------------

function associate (models) {
  this.belongsTo(models.Video, {
    foreignKey: {
      name: 'videoId',
      allowNull: false
    },
    onDelete: 'CASCADE'
  })
}

function countTotalRequests (callback) {
  const query = {}
  return this.count(query).asCallback(callback)
}

function listWithLimitAndRandom (limitPods, limitRequestsPerPod, callback) {
  const self = this
  const Pod = this.sequelize.models.Pod

  // We make a join between videos and authors to find the podId of our video event requests
  const podJoins = 'INNER JOIN "Videos" ON "Videos"."authorId" = "Authors"."id" ' +
                   'INNER JOIN "RequestVideoEvents" ON "RequestVideoEvents"."videoId" = "Videos"."id"'

  Pod.listRandomPodIdsWithRequest(limitPods, 'Authors', podJoins, function (err, podIds) {
    if (err) return callback(err)

    // We don't have friends that have requests
    if (podIds.length === 0) return callback(null, [])

    const query = {
      include: [
        {
          model: self.sequelize.models.Video,
          include: [
            {
              model: self.sequelize.models.Author,
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
          ]
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
      }
    },
    include: [
      {
        model: this.sequelize.models.Video,
        include: [
          {
            model: this.sequelize.models.Author,
            where: {
              podId
            }
          }
        ]
      }
    ]
  }

  this.destroy(query).asCallback(callback)
}

function removeAll (callback) {
  // Delete all requests
  this.truncate({ cascade: true }).asCallback(callback)
}

// ---------------------------------------------------------------------------

function groupAndTruncateRequests (events, limitRequestsPerPod) {
  const eventsGrouped = {}

  events.forEach(function (event) {
    const pod = event.Video.Author.Pod

    if (!eventsGrouped[pod.id]) eventsGrouped[pod.id] = []

    if (eventsGrouped[pod.id].length < limitRequestsPerPod) {
      eventsGrouped[pod.id].push({
        id: event.id,
        type: event.type,
        count: event.count,
        video: event.Video,
        pod
      })
    }
  })

  return eventsGrouped
}
