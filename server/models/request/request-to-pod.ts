import * as Sequelize from 'sequelize'

import { addMethodsToModel } from '../utils'
import {
  RequestToPodInstance,
  RequestToPodAttributes,

  RequestToPodMethods
} from './request-to-pod-interface'

let RequestToPod: Sequelize.Model<RequestToPodInstance, RequestToPodAttributes>
let removeByRequestIdsAndPod: RequestToPodMethods.RemoveByRequestIdsAndPod

export default function (sequelize: Sequelize.Sequelize, DataTypes: Sequelize.DataTypes) {
  RequestToPod = sequelize.define<RequestToPodInstance, RequestToPodAttributes>('RequestToPod', {}, {
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

removeByRequestIdsAndPod = function (requestsIds: number[], podId: number) {
  const query = {
    where: {
      requestId: {
        [Sequelize.Op.in]: requestsIds
      },
      podId: podId
    }
  }

  return RequestToPod.destroy(query)
}
