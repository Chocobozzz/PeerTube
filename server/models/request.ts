import { values } from 'lodash'
import * as Sequelize from 'sequelize'

import { database as db } from '../initializers/database'
import { REQUEST_ENDPOINTS } from '../initializers'
import { addMethodsToModel } from './utils'
import {
  RequestClass,
  RequestInstance,
  RequestAttributes,

  RequestMethods,
  RequestsGrouped
} from './request-interface'

let Request: Sequelize.Model<RequestInstance, RequestAttributes>
let countTotalRequests: RequestMethods.CountTotalRequests
let listWithLimitAndRandom: RequestMethods.ListWithLimitAndRandom
let removeWithEmptyTo: RequestMethods.RemoveWithEmptyTo
let removeAll: RequestMethods.RemoveAll

export default function (sequelize: Sequelize.Sequelize, DataTypes: Sequelize.DataTypes) {
  Request = sequelize.define<RequestInstance, RequestAttributes>('Request',
    {
      request: {
        type: DataTypes.JSON,
        allowNull: false
      },
      endpoint: {
        type: DataTypes.ENUM(values(REQUEST_ENDPOINTS)),
        allowNull: false
      }
    }
  )

  const classMethods = [
    associate,

    listWithLimitAndRandom,

    countTotalRequests,
    removeAll,
    removeWithEmptyTo
  ]
  addMethodsToModel(Request, classMethods)

  return Request
}

// ------------------------------ STATICS ------------------------------

function associate (models) {
  Request.belongsToMany(models.Pod, {
    foreignKey: {
      name: 'requestId',
      allowNull: false
    },
    through: models.RequestToPod,
    onDelete: 'CASCADE'
  })
}

countTotalRequests = function (callback: RequestMethods.CountTotalRequestsCallback) {
  // We need to include Pod because there are no cascade delete when a pod is removed
  // So we could count requests that do not have existing pod anymore
  const query = {
    include: [ Request['sequelize'].models.Pod ]
  }

  return Request.count(query).asCallback(callback)
}

listWithLimitAndRandom = function (limitPods: number, limitRequestsPerPod: number, callback: RequestMethods.ListWithLimitAndRandomCallback) {
  const Pod = db.Pod
  const tableJoin = ''

  Pod.listRandomPodIdsWithRequest(limitPods, 'RequestToPods', '', function (err, podIds) {
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
          model: Request['sequelize'].models.Pod,
          where: {
            id: {
              $in: podIds
            }
          }
        }
      ]
    }

    Request.findAll(query).asCallback(function (err, requests) {
      if (err) return callback(err)

      const requestsGrouped = groupAndTruncateRequests(requests, limitRequestsPerPod)
      return callback(err, requestsGrouped)
    })
  })
}

removeAll = function (callback: RequestMethods.RemoveAllCallback) {
  // Delete all requests
  Request.truncate({ cascade: true }).asCallback(callback)
}

removeWithEmptyTo = function (callback?: RequestMethods.RemoveWithEmptyToCallback) {
  if (!callback) callback = function () { /* empty */ }

  const query = {
    where: {
      id: {
        $notIn: [
          Sequelize.literal('SELECT "requestId" FROM "RequestToPods"')
        ]
      }
    }
  }

  Request.destroy(query).asCallback(callback)
}

// ---------------------------------------------------------------------------

function groupAndTruncateRequests (requests: RequestInstance[], limitRequestsPerPod: number) {
  const requestsGrouped: RequestsGrouped = {}

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
