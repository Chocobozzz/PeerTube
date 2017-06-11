/*
  Request Video events (likes, dislikes, views...)
*/

import { values } from 'lodash'
import * as Sequelize from 'sequelize'

import { database as db } from '../initializers/database'
import { REQUEST_VIDEO_EVENT_TYPES } from '../initializers'
import { isVideoEventCountValid } from '../helpers'
import { addMethodsToModel } from './utils'
import {
  RequestVideoEventClass,
  RequestVideoEventInstance,
  RequestVideoEventAttributes,

  RequestVideoEventMethods,
  RequestsVideoEventGrouped
} from './request-video-event-interface'

let RequestVideoEvent: Sequelize.Model<RequestVideoEventInstance, RequestVideoEventAttributes>
let countTotalRequests: RequestVideoEventMethods.CountTotalRequests
let listWithLimitAndRandom: RequestVideoEventMethods.ListWithLimitAndRandom
let removeByRequestIdsAndPod: RequestVideoEventMethods.RemoveByRequestIdsAndPod
let removeAll: RequestVideoEventMethods.RemoveAll

export default function (sequelize: Sequelize.Sequelize, DataTypes: Sequelize.DataTypes) {
  RequestVideoEvent = sequelize.define<RequestVideoEventInstance, RequestVideoEventAttributes>('RequestVideoEvent',
    {
      type: {
        type: DataTypes.ENUM(values(REQUEST_VIDEO_EVENT_TYPES)),
        allowNull: false
      },
      count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
          countValid: function (value) {
            const res = isVideoEventCountValid(value)
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
      ]
    }
  )

  const classMethods = [
    associate,

    listWithLimitAndRandom,
    countTotalRequests,
    removeAll,
    removeByRequestIdsAndPod
  ]
  addMethodsToModel(RequestVideoEvent, classMethods)

  return RequestVideoEvent
}

// ------------------------------ STATICS ------------------------------

function associate (models) {
  RequestVideoEvent.belongsTo(models.Video, {
    foreignKey: {
      name: 'videoId',
      allowNull: false
    },
    onDelete: 'CASCADE'
  })
}

countTotalRequests = function (callback: RequestVideoEventMethods.CountTotalRequestsCallback) {
  const query = {}
  return RequestVideoEvent.count(query).asCallback(callback)
}

listWithLimitAndRandom = function (limitPods: number, limitRequestsPerPod: number, callback: RequestVideoEventMethods.ListWithLimitAndRandomCallback) {
  const Pod = db.Pod

  // We make a join between videos and authors to find the podId of our video event requests
  const podJoins = 'INNER JOIN "Videos" ON "Videos"."authorId" = "Authors"."id" ' +
                   'INNER JOIN "RequestVideoEvents" ON "RequestVideoEvents"."videoId" = "Videos"."id"'

  Pod.listRandomPodIdsWithRequest(limitPods, 'Authors', podJoins, function (err, podIds) {
    if (err) return callback(err)

    // We don't have friends that have requests
    if (podIds.length === 0) return callback(null, [])

    const query = {
      order: [
        [ 'id', 'ASC' ]
      ],
      include: [
        {
          model: RequestVideoEvent['sequelize'].models.Video,
          include: [
            {
              model: RequestVideoEvent['sequelize'].models.Author,
              include: [
                {
                  model: RequestVideoEvent['sequelize'].models.Pod,
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

    RequestVideoEvent.findAll(query).asCallback(function (err, requests) {
      if (err) return callback(err)

      const requestsGrouped = groupAndTruncateRequests(requests, limitRequestsPerPod)
      return callback(err, requestsGrouped)
    })
  })
}

removeByRequestIdsAndPod = function (ids: number[], podId: number, callback: RequestVideoEventMethods.RemoveByRequestIdsAndPodCallback) {
  const query = {
    where: {
      id: {
        $in: ids
      }
    },
    include: [
      {
        model: RequestVideoEvent['sequelize'].models.Video,
        include: [
          {
            model: RequestVideoEvent['sequelize'].models.Author,
            where: {
              podId
            }
          }
        ]
      }
    ]
  }

  RequestVideoEvent.destroy(query).asCallback(callback)
}

removeAll = function (callback: RequestVideoEventMethods.RemoveAllCallback) {
  // Delete all requests
  RequestVideoEvent.truncate({ cascade: true }).asCallback(callback)
}

// ---------------------------------------------------------------------------

function groupAndTruncateRequests (events: RequestVideoEventInstance[], limitRequestsPerPod: number) {
  const eventsGrouped: RequestsVideoEventGrouped = {}

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
