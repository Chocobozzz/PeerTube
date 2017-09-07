import * as Sequelize from 'sequelize'
import * as Promise from 'bluebird'

import { AbstractRequestClass } from './abstract-request-interface'
import { PodInstance, PodAttributes } from '../pod/pod-interface'
import { RequestEndpoint } from '../../../shared/models/request-scheduler.model'

export type RequestsGrouped = {
  [ podId: number ]: {
    request: RequestInstance,
    pod: PodInstance
  }[]
}

export namespace RequestMethods {
  export type CountTotalRequests = () => Promise<number>

  export type ListWithLimitAndRandom = (limitPods: number, limitRequestsPerPod: number) => Promise<RequestsGrouped>

  export type RemoveWithEmptyTo = () => Promise<number>

  export type RemoveAll = () => Promise<void>
}

export interface RequestClass extends AbstractRequestClass<RequestsGrouped> {
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
