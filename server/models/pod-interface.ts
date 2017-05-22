import * as Sequelize from 'sequelize'

export namespace PodMethods {
  export type ToFormatedJSON = () => void

  export type CountAll = (callback) => void
  export type IncrementScores = (ids, value, callback) => void
  export type List = (callback) => void
  export type ListAllIds = (transaction, callback) => void
  export type ListRandomPodIdsWithRequest = (limit, tableWithPods, tableWithPodsJoins, callback) => void
  export type ListBadPods = (callback) => void
  export type Load = (id, callback) => void
  export type LoadByHost = (host, callback) => void
  export type RemoveAll = (callback) => void
  export type UpdatePodsScore = (goodPods, badPods) => void
}

export interface PodClass {
  countAll: PodMethods.CountAll
  incrementScores: PodMethods.IncrementScores
  list: PodMethods.List
  listAllIds: PodMethods.ListAllIds
  listRandomPodIdsWithRequest: PodMethods.ListRandomPodIdsWithRequest
  listBadPods: PodMethods.ListBadPods
  load: PodMethods.Load
  loadByHost: PodMethods.LoadByHost
  removeAll: PodMethods.RemoveAll
  updatePodsScore: PodMethods.UpdatePodsScore
}

export interface PodAttributes {
  host?: string
  publicKey?: string
  score?: number | Sequelize.literal // Sequelize literal for 'score +' + value
  email?: string
}

export interface PodInstance extends PodClass, PodAttributes, Sequelize.Instance<PodAttributes> {
  id: number
  createdAt: Date
  updatedAt: Date

  toFormatedJSON: PodMethods.ToFormatedJSON,
}

export interface PodModel extends PodClass, Sequelize.Model<PodInstance, PodAttributes> {}
