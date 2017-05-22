import * as Sequelize from 'sequelize'

import { addMethodsToModel } from './utils'
import {
  RequestToPodClass,
  RequestToPodInstance,
  RequestToPodAttributes,

  RequestToPodMethods
} from './request-to-pod-interface'

let RequestToPod: Sequelize.Model<RequestToPodInstance, RequestToPodAttributes>
let removeByRequestIdsAndPod: RequestToPodMethods.RemoveByRequestIdsAndPod

export default function (sequelize, DataTypes) {
  RequestToPod = sequelize.define('RequestToPod', {}, {
    indexes: [
      {
        fields: [ 'requestId' ]
      },
      {
        fields: [ 'podId' ]
      },
      {
        fields: [ 'requestId', 'podId' ],
        unique: true
      }
    ]
  })

  const classMethods = [
    removeByRequestIdsAndPod
  ]
  addMethodsToModel(RequestToPod, classMethods)

  return RequestToPod
}

// ---------------------------------------------------------------------------

removeByRequestIdsAndPod = function (requestsIds, podId, callback) {
  if (!callback) callback = function () { /* empty */ }

  const query = {
    where: {
      requestId: {
        $in: requestsIds
      },
      podId: podId
    }
  }

  RequestToPod.destroy(query).asCallback(callback)
}
