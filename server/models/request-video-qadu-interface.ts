import * as Sequelize from 'sequelize'

export namespace RequestVideoQaduMethods {
  export type CountTotalRequests = (callback) => void
  export type ListWithLimitAndRandom = (limitPods, limitRequestsPerPod, callback) => void
  export type RemoveByRequestIdsAndPod = (ids, podId, callback) => void
  export type RemoveAll = (callback) => void
}

export interface RequestVideoQaduClass {
  countTotalRequests: RequestVideoQaduMethods.CountTotalRequests
  listWithLimitAndRandom: RequestVideoQaduMethods.ListWithLimitAndRandom
  removeByRequestIdsAndPod: RequestVideoQaduMethods.RemoveByRequestIdsAndPod
  removeAll: RequestVideoQaduMethods.RemoveAll
}

export interface RequestVideoQaduAttributes {
  type: string
}

export interface RequestVideoQaduInstance extends Sequelize.Instance<RequestVideoQaduAttributes> {
  id: number
}

export interface RequestVideoQaduModel extends RequestVideoQaduClass, Sequelize.Model<RequestVideoQaduInstance, RequestVideoQaduAttributes> {}
