import * as Sequelize from 'sequelize'

import { PodAttributes } from './pod-interface'

export namespace RequestMethods {
  export type CountTotalRequests = (callback) => void
  export type ListWithLimitAndRandom = (limitPods, limitRequestsPerPod, callback) => void
  export type RemoveWithEmptyTo = (callback) => void
  export type RemoveAll = (callback) => void
}

export interface RequestClass {
  countTotalRequests: RequestMethods.CountTotalRequests
  listWithLimitAndRandom: RequestMethods.ListWithLimitAndRandom
  removeWithEmptyTo: RequestMethods.RemoveWithEmptyTo
  removeAll: RequestMethods.RemoveAll
}

export interface RequestAttributes {
  request: object
  endpoint: string
}

export interface RequestInstance extends Sequelize.Instance<RequestAttributes> {
  id: number
  createdAt: Date
  updatedAt: Date

  setPods: Sequelize.HasManySetAssociationsMixin<PodAttributes, number>
}

export interface RequestModel extends RequestClass, Sequelize.Model<RequestInstance, RequestAttributes> {}
