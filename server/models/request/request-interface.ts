import * as Sequelize from 'sequelize'

import { PodInstance, PodAttributes } from '../pod'
import { RequestEndpoint } from '../../../shared/models/request-scheduler.model'

export type RequestsGrouped = {
  [ podId: number ]: {
    request: RequestInstance,
    pod: PodInstance
  }[]
}

export namespace RequestMethods {
  export type CountTotalRequestsCallback = (err: Error, total: number) => void
  export type CountTotalRequests = (callback: CountTotalRequestsCallback) => void

  export type ListWithLimitAndRandomCallback = (err: Error, requestsGrouped?: RequestsGrouped) => void
  export type ListWithLimitAndRandom = (limitPods, limitRequestsPerPod, callback: ListWithLimitAndRandomCallback) => void

  export type RemoveWithEmptyToCallback = (err: Error) => void
  export type RemoveWithEmptyTo = (callback: RemoveWithEmptyToCallback) => void

  export type RemoveAllCallback = (err: Error) => void
  export type RemoveAll = (callback: RemoveAllCallback) => void
}

export interface RequestClass {
  countTotalRequests: RequestMethods.CountTotalRequests
  listWithLimitAndRandom: RequestMethods.ListWithLimitAndRandom
  removeWithEmptyTo: RequestMethods.RemoveWithEmptyTo
  removeAll: RequestMethods.RemoveAll
}

export interface RequestAttributes {
  request: object
  endpoint: RequestEndpoint
}

export interface RequestInstance extends RequestClass, RequestAttributes, Sequelize.Instance<RequestAttributes> {
  id: number
  createdAt: Date
  updatedAt: Date

  setPods: Sequelize.HasManySetAssociationsMixin<PodAttributes, number>
  Pods: PodInstance[]
}

export interface RequestModel extends RequestClass, Sequelize.Model<RequestInstance, RequestAttributes> {}
