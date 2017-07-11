import { values } from 'lodash'
import * as Sequelize from 'sequelize'

import { database as db } from '../../initializers/database'
import { REQUEST_ENDPOINTS } from '../../initializers'
import { addMethodsToModel } from '../utils'
import {
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

countTotalRequests = function () {
  // We need to include Pod because there are no cascade delete when a pod is removed
  // So we could count requests that do not have existing pod anymore
  const query = {
    include: [ Request['sequelize'].models.Pod ]
  }

  return Request.count(query)
}

listWithLimitAndRandom = function (limitPods: number, limitRequestsPerPod: number) {
  const Pod = db.Pod
  const tableJoin = ''

  return Pod.listRandomPodIdsWithRequest(limitPods, 'RequestToPods', tableJoin).then(podIds => {
    // We don't have friends that have requests
    if (podIds.length === 0) return []

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

    return Request.findAll(query).then(requests => {

      const requestsGrouped = groupAndTruncateRequests(requests, limitRequestsPerPod)
      return requestsGrouped
    })
  })
}

removeAll = function () {
  // Delete all requests
  return Request.truncate({ cascade: true })
}

removeWithEmptyTo = function () {
  const query = {
    where: {
      id: {
        $notIn: [
          Sequelize.literal('SELECT "requestId" FROM "RequestToPods"')
        ]
      }
    }
  }

  return Request.destroy(query)
}

// ---------------------------------------------------------------------------

function groupAndTruncateRequests (requests: RequestInstance[], limitRequestsPerPod: number) {
  const requestsGrouped: RequestsGrouped = {}

  requests.forEach(request => {
    request.Pods.forEach(pod => {
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
