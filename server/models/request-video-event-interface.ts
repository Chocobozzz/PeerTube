import * as Sequelize from 'sequelize'

import { VideoInstance } from './video-interface'
import { PodInstance } from './pod-interface'

export type RequestsVideoEventGrouped = {
  [ podId: number ]: {
    id: number
    type: string
    count: number
    video: VideoInstance
    pod: PodInstance
  }[]
}

export namespace RequestVideoEventMethods {
  export type CountTotalRequestsCallback = (err: Error, total: number) => void
  export type CountTotalRequests = (callback: CountTotalRequestsCallback) => void

  export type ListWithLimitAndRandomCallback = (err: Error, requestsGrouped?: RequestsVideoEventGrouped) => void
  export type ListWithLimitAndRandom = (limitPods: number, limitRequestsPerPod: number, callback: ListWithLimitAndRandomCallback) => void

  export type RemoveByRequestIdsAndPodCallback = () => void
  export type RemoveByRequestIdsAndPod = (ids: number[], podId: number, callback: RemoveByRequestIdsAndPodCallback) => void

  export type RemoveAllCallback = () => void
  export type RemoveAll = (callback: RemoveAllCallback) => void
}

export interface RequestVideoEventClass {
  countTotalRequests: RequestVideoEventMethods.CountTotalRequests
  listWithLimitAndRandom: RequestVideoEventMethods.ListWithLimitAndRandom
  removeByRequestIdsAndPod: RequestVideoEventMethods.RemoveByRequestIdsAndPod
  removeAll: RequestVideoEventMethods.RemoveAll
}

export interface RequestVideoEventAttributes {
  type: string
  count: number
}

export interface RequestVideoEventInstance extends RequestVideoEventClass, RequestVideoEventAttributes, Sequelize.Instance<RequestVideoEventAttributes> {
  id: number

  Video: VideoInstance
}

export interface RequestVideoEventModel extends RequestVideoEventClass, Sequelize.Model<RequestVideoEventInstance, RequestVideoEventAttributes> {}
