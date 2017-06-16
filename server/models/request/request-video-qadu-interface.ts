import * as Sequelize from 'sequelize'

import { VideoInstance } from '../video'
import { PodInstance } from '../pod'

import { RequestVideoQaduType } from '../../../shared/models/request-scheduler.model'

export type RequestsVideoQaduGrouped = {
  [ podId: number ]: {
    request: RequestVideoQaduInstance
    video: VideoInstance
    pod: PodInstance
  }
}

export namespace RequestVideoQaduMethods {
  export type CountTotalRequestsCallback = (err: Error, total: number) => void
  export type CountTotalRequests = (callback: CountTotalRequestsCallback) => void

  export type ListWithLimitAndRandomCallback = (err: Error, requestsGrouped?: RequestsVideoQaduGrouped) => void
  export type ListWithLimitAndRandom = (limitPods: number, limitRequestsPerPod: number, callback: ListWithLimitAndRandomCallback) => void

  export type RemoveByRequestIdsAndPodCallback = () => void
  export type RemoveByRequestIdsAndPod = (ids: number[], podId: number, callback: RemoveByRequestIdsAndPodCallback) => void

  export type RemoveAllCallback = () => void
  export type RemoveAll = (callback: RemoveAllCallback) => void
}

export interface RequestVideoQaduClass {
  countTotalRequests: RequestVideoQaduMethods.CountTotalRequests
  listWithLimitAndRandom: RequestVideoQaduMethods.ListWithLimitAndRandom
  removeByRequestIdsAndPod: RequestVideoQaduMethods.RemoveByRequestIdsAndPod
  removeAll: RequestVideoQaduMethods.RemoveAll
}

export interface RequestVideoQaduAttributes {
  type: RequestVideoQaduType
}

export interface RequestVideoQaduInstance extends RequestVideoQaduClass, RequestVideoQaduAttributes, Sequelize.Instance<RequestVideoQaduAttributes> {
  id: number

  Pod: PodInstance
  Video: VideoInstance
}

export interface RequestVideoQaduModel extends RequestVideoQaduClass, Sequelize.Model<RequestVideoQaduInstance, RequestVideoQaduAttributes> {}
