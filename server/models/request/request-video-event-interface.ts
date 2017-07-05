import * as Sequelize from 'sequelize'
import * as Promise from 'bluebird'

import { AbstractRequestClass, AbstractRequestToPodClass } from './abstract-request-interface'
import { VideoInstance } from '../video'
import { PodInstance } from '../pod'

import { RequestVideoEventType } from '../../../shared/models/request-scheduler.model'

export type RequestsVideoEventGrouped = {
  [ podId: number ]: {
    id: number
    type: RequestVideoEventType
    count: number
    video: VideoInstance
    pod: PodInstance
  }[]
}

export namespace RequestVideoEventMethods {
  export type CountTotalRequests = () => Promise<number>

  export type ListWithLimitAndRandom = (limitPods: number, limitRequestsPerPod: number) => Promise<RequestsVideoEventGrouped>

  export type RemoveByRequestIdsAndPod = (ids: number[], podId: number) => Promise<number>

  export type RemoveAll = () => Promise<void>
}

export interface RequestVideoEventClass extends AbstractRequestClass<RequestsVideoEventGrouped>, AbstractRequestToPodClass {
  countTotalRequests: RequestVideoEventMethods.CountTotalRequests
  listWithLimitAndRandom: RequestVideoEventMethods.ListWithLimitAndRandom
  removeByRequestIdsAndPod: RequestVideoEventMethods.RemoveByRequestIdsAndPod
  removeAll: RequestVideoEventMethods.RemoveAll
}

export interface RequestVideoEventAttributes {
  type: RequestVideoEventType
  count: number
}

export interface RequestVideoEventInstance
  extends RequestVideoEventClass, RequestVideoEventAttributes, Sequelize.Instance<RequestVideoEventAttributes> {
  id: number

  Video: VideoInstance
}

export interface RequestVideoEventModel
  extends RequestVideoEventClass, Sequelize.Model<RequestVideoEventInstance, RequestVideoEventAttributes> {}
