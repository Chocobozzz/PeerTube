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

import { REQUEST_VIDEO_QADU_TYPES } from '../initializers'

import { addMethodsToModel } from './utils'
import {
  RequestVideoQaduClass,
  RequestVideoQaduInstance,
  RequestVideoQaduAttributes,

  RequestVideoQaduMethods
} from './request-video-qadu-interface'

let RequestVideoQadu: Sequelize.Model<RequestVideoQaduInstance, RequestVideoQaduAttributes>
let countTotalRequests: RequestVideoQaduMethods.CountTotalRequests
let listWithLimitAndRandom: RequestVideoQaduMethods.ListWithLimitAndRandom
let removeByRequestIdsAndPod: RequestVideoQaduMethods.RemoveByRequestIdsAndPod
let removeAll: RequestVideoQaduMethods.RemoveAll

export default function (sequelize, DataTypes) {
  RequestVideoQadu = sequelize.define('RequestVideoQadu',
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

countTotalRequests = function (callback) {
  const query = {}
  return RequestVideoQadu.count(query).asCallback(callback)
}

listWithLimitAndRandom = function (limitPods, limitRequestsPerPod, callback) {
  const Pod = RequestVideoQadu['sequelize'].models.Pod

  Pod.listRandomPodIdsWithRequest(limitPods, 'RequestVideoQadus', function (err, podIds) {
    if (err) return callback(err)

    // We don't have friends that have requests
    if (podIds.length === 0) return callback(null, [])

    const query = {
      include: [
        {
          model: RequestVideoQadu['sequelize'].models.Pod,
          where: {
            id: {
              $in: podIds
            }
          }
        },
        {
          model: RequestVideoQadu['sequelize'].models.Video
        }
      ]
    }

    RequestVideoQadu.findAll(query).asCallback(function (err, requests) {
      if (err) return callback(err)

      const requestsGrouped = groupAndTruncateRequests(requests, limitRequestsPerPod)
      return callback(err, requestsGrouped)
    })
  })
}

removeByRequestIdsAndPod = function (ids, podId, callback) {
  const query = {
    where: {
      id: {
        $in: ids
      },
      podId
    }
  }

  RequestVideoQadu.destroy(query).asCallback(callback)
}

removeAll = function (callback) {
  // Delete all requests
  RequestVideoQadu.truncate({ cascade: true }).asCallback(callback)
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
