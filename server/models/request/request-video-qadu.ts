/*
  Request Video for Quick And Dirty Updates like:
   - views
   - likes
   - dislikes

  We can't put it in the same system than basic requests for efficiency.
  Moreover we don't want to slow down the basic requests with a lot of views/likes/dislikes requests.
  So we put it an independant request scheduler.
*/

import { values } from 'lodash'
import * as Sequelize from 'sequelize'

import { database as db } from '../../initializers/database'
import { REQUEST_VIDEO_QADU_TYPES } from '../../initializers'
import { addMethodsToModel } from '../utils'
import {
  RequestVideoQaduInstance,
  RequestVideoQaduAttributes,

  RequestVideoQaduMethods
} from './request-video-qadu-interface'

let RequestVideoQadu: Sequelize.Model<RequestVideoQaduInstance, RequestVideoQaduAttributes>
let countTotalRequests: RequestVideoQaduMethods.CountTotalRequests
let listWithLimitAndRandom: RequestVideoQaduMethods.ListWithLimitAndRandom
let removeByRequestIdsAndPod: RequestVideoQaduMethods.RemoveByRequestIdsAndPod
let removeAll: RequestVideoQaduMethods.RemoveAll

export default function (sequelize: Sequelize.Sequelize, DataTypes: Sequelize.DataTypes) {
  RequestVideoQadu = sequelize.define<RequestVideoQaduInstance, RequestVideoQaduAttributes>('RequestVideoQadu',
    {
      type: {
        type: DataTypes.ENUM(values(REQUEST_VIDEO_QADU_TYPES)),
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
  addMethodsToModel(RequestVideoQadu, classMethods)

  return RequestVideoQadu
}

// ------------------------------ STATICS ------------------------------

function associate (models) {
  RequestVideoQadu.belongsTo(models.Pod, {
    foreignKey: {
      name: 'podId',
      allowNull: false
    },
    onDelete: 'CASCADE'
  })

  RequestVideoQadu.belongsTo(models.Video, {
    foreignKey: {
      name: 'videoId',
      allowNull: false
    },
    onDelete: 'CASCADE'
  })
}

countTotalRequests = function () {
  const query = {}
  return RequestVideoQadu.count(query)
}

listWithLimitAndRandom = function (limitPods: number, limitRequestsPerPod: number) {
  const Pod = db.Pod
  const tableJoin = ''

  return Pod.listRandomPodIdsWithRequest(limitPods, 'RequestVideoQadus', tableJoin).then(podIds => {
    // We don't have friends that have requests
    if (podIds.length === 0) return []

    const query = {
      include: [
        {
          model: RequestVideoQadu['sequelize'].models.Pod,
          where: {
            id: {
              [Sequelize.Op.in]: podIds
            }
          }
        },
        {
          model: RequestVideoQadu['sequelize'].models.Video
        }
      ]
    }

    return RequestVideoQadu.findAll(query).then(requests => {
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
      },
      podId
    }
  }

  return RequestVideoQadu.destroy(query)
}

removeAll = function () {
  // Delete all requests
  return RequestVideoQadu.truncate({ cascade: true })
}

// ---------------------------------------------------------------------------

function groupAndTruncateRequests (requests: RequestVideoQaduInstance[], limitRequestsPerPod: number) {
  const requestsGrouped = {}

  requests.forEach(request => {
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
