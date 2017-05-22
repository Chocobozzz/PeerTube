import * as Sequelize from 'sequelize'

export namespace RequestVideoEventMethods {
  export type CountTotalRequests = (callback) => void
  export type ListWithLimitAndRandom = (limitPods, limitRequestsPerPod, callback) => void
  export type RemoveByRequestIdsAndPod = (ids, podId, callback) => void
  export type RemoveAll = (callback) => void
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

export interface RequestVideoEventInstance extends Sequelize.Instance<RequestVideoEventAttributes> {
  id: number
}

export interface RequestVideoEventModel extends RequestVideoEventClass, Sequelize.Model<RequestVideoEventInstance, RequestVideoEventAttributes> {}
