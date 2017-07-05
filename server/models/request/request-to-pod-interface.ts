import * as Sequelize from 'sequelize'
import * as Promise from 'bluebird'

import { AbstractRequestToPodClass } from './abstract-request-interface'

export namespace RequestToPodMethods {
  export type RemoveByRequestIdsAndPod = (requestsIds: number[], podId: number) => Promise<number>
}

export interface RequestToPodClass extends AbstractRequestToPodClass {
  removeByRequestIdsAndPod: RequestToPodMethods.RemoveByRequestIdsAndPod
}

export interface RequestToPodAttributes {
}

export interface RequestToPodInstance extends RequestToPodClass, RequestToPodAttributes, Sequelize.Instance<RequestToPodAttributes> {
  id: number
  createdAt: Date
  updatedAt: Date
}

export interface RequestToPodModel extends RequestToPodClass, Sequelize.Model<RequestToPodInstance, RequestToPodAttributes> {}
