import * as Sequelize from 'sequelize'

export namespace RequestToPodMethods {
  export type RemoveByRequestIdsAndPodCallback = (err: Error) => void
  export type RemoveByRequestIdsAndPod = (requestsIds: number[], podId: number, callback?: RemoveByRequestIdsAndPodCallback) => void
}

export interface RequestToPodClass {
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
