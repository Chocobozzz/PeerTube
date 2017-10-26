/*
  Request Video events (likes, dislikes, views...)
*/

import { values } from 'lodash'
import * as Sequelize from 'sequelize'

import { database as db } from '../../initializers/database'
import { REQUEST_VIDEO_EVENT_TYPES } from '../../initializers'
import { isVideoEventCountValid } from '../../helpers'
import { addMethodsToModel } from '../utils'
import {
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

countTotalRequests = function () {
  const query = {}
  return RequestVideoEvent.count(query)
}

listWithLimitAndRandom = function (limitPods: number, limitRequestsPerPod: number) {
  const Pod = db.Pod

  // We make a join between videos and authors to find the podId of our video event requests
  const podJoins = 'INNER JOIN "VideoChannels" ON "VideoChannels"."authorId" = "Authors"."id" ' +
                   'INNER JOIN "Videos" ON "Videos"."channelId" = "VideoChannels"."id" ' +
                   'INNER JOIN "RequestVideoEvents" ON "RequestVideoEvents"."videoId" = "Videos"."id"'

  return Pod.listRandomPodIdsWithRequest(limitPods, 'Authors', podJoins).then(podIds => {
    // We don't have friends that have requests
    if (podIds.length === 0) return []

    const query = {
      order: [
        [ 'id', 'ASC' ]
      ],
      include: [
        {
          model: RequestVideoEvent['sequelize'].models.Video,
          include: [
            {
              model: RequestVideoEvent['sequelize'].models.VideoChannel,
              include: [
                {
                  model: RequestVideoEvent['sequelize'].models.Author,
                  include: [
                    {
                      model: RequestVideoEvent['sequelize'].models.Pod,
                      where: {
                        id: {
                          [Sequelize.Op.in]: podIds
                        }
                      }
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }

    return RequestVideoEvent.findAll(query).then(requests => {
      const requestsGrouped = groupAndTruncateRequests(requests, limitRequestsPerPod)
      return requestsGrouped
    })
  })
}

removeByRequestIdsAndPod = function (ids: number[], podId: number) {
  const query = {
    where: {
      id: {
        [Sequelize.Op.in]: ids
      }
    },
    include: [
      {
        model: RequestVideoEvent['sequelize'].models.Video,
        include: [
          {
            model: RequestVideoEvent['sequelize'].models.VideoChannel,
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
    ]
  }

  return RequestVideoEvent.destroy(query)
}

removeAll = function () {
  // Delete all requests
  return RequestVideoEvent.truncate({ cascade: true })
}

// ---------------------------------------------------------------------------

function groupAndTruncateRequests (events: RequestVideoEventInstance[], limitRequestsPerPod: number) {
  const eventsGrouped: RequestsVideoEventGrouped = {}

  events.forEach(event => {
    const pod = event.Video.VideoChannel.Author.Pod

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
