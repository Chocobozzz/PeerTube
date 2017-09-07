import * as Sequelize from 'sequelize'
import * as Promise from 'bluebird'

import { AbstractRequestClass, AbstractRequestToPodClass } from './abstract-request-interface'
import { VideoInstance } from '../video/video-interface'
import { PodInstance } from '../pod/pod-interface'

import { RequestVideoQaduType } from '../../../shared/models/request-scheduler.model'

export type RequestsVideoQaduGrouped = {
  [ podId: number ]: {
    request: RequestVideoQaduInstance
    video: VideoInstance
    pod: PodInstance
  }
}

export namespace RequestVideoQaduMethods {
  export type CountTotalRequests = () => Promise<number>

  export type ListWithLimitAndRandom = (limitPods: number, limitRequestsPerPod: number) => Promise<RequestsVideoQaduGrouped>

  export type RemoveByRequestIdsAndPod = (ids: number[], podId: number) => Promise<number>

  export type RemoveAll = () => Promise<void>
}

export interface RequestVideoQaduClass extends AbstractRequestClass<RequestsVideoQaduGrouped>, AbstractRequestToPodClass {
  countTotalRequests: RequestVideoQaduMethods.CountTotalRequests
  listWithLimitAndRandom: RequestVideoQaduMethods.ListWithLimitAndRandom
  removeByRequestIdsAndPod: RequestVideoQaduMethods.RemoveByRequestIdsAndPod
  removeAll: RequestVideoQaduMethods.RemoveAll
}

export interface RequestVideoQaduAttributes {
  type: RequestVideoQaduType
}

export interface RequestVideoQaduInstance
  extends RequestVideoQaduClass, RequestVideoQaduAttributes, Sequelize.Instance<RequestVideoQaduAttributes> {
  id: number

  Pod: PodInstance
  Video: VideoInstance
}

export interface RequestVideoQaduModel
  extends RequestVideoQaduClass, Sequelize.Model<RequestVideoQaduInstance, RequestVideoQaduAttributes> {}
