import * as Sequelize from 'sequelize'

export namespace RequestToPodMethods {
  export type RemoveByRequestIdsAndPod = (requestsIds, podId, callback) => void
}

export interface RequestToPodClass {
  removeByRequestIdsAndPod: RequestToPodMethods.RemoveByRequestIdsAndPod
}

export interface RequestToPodAttributes {
}

export interface RequestToPodInstance extends Sequelize.Instance<RequestToPodAttributes> {
  id: number
  createdAt: Date
  updatedAt: Date
}

export interface RequestToPodModel extends RequestToPodClass, Sequelize.Model<RequestToPodInstance, RequestToPodAttributes> {}
