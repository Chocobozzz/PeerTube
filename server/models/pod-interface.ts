import * as Sequelize from 'sequelize'

// Don't use barrel, import just what we need
import { Pod as FormatedPod } from '../../shared/models/pod.model'

export namespace PodMethods {
  export type ToFormatedJSON = () => FormatedPod

  export type CountAllCallback = (err: Error, total: number) => void
  export type CountAll = (callback) => void

  export type IncrementScoresCallback = (err: Error) => void
  export type IncrementScores = (ids: number[], value: number, callback?: IncrementScoresCallback) => void

  export type ListCallback = (err: Error, podInstances?: PodInstance[]) => void
  export type List = (callback: ListCallback) => void

  export type ListAllIdsCallback = (err: Error, ids?: number[]) => void
  export type ListAllIds = (transaction: Sequelize.Transaction, callback: ListAllIdsCallback) => void

  export type ListRandomPodIdsWithRequestCallback = (err: Error, podInstanceIds?: number[]) => void
  export type ListRandomPodIdsWithRequest = (limit: number, tableWithPods: string, tableWithPodsJoins: string, callback: ListRandomPodIdsWithRequestCallback) => void

  export type ListBadPodsCallback = (err: Error, podInstances?: PodInstance[]) => void
  export type ListBadPods = (callback: ListBadPodsCallback) => void

  export type LoadCallback = (err: Error, podInstance: PodInstance) => void
  export type Load = (id: number, callback: LoadCallback) => void

  export type LoadByHostCallback = (err: Error, podInstance: PodInstance) => void
  export type LoadByHost = (host: string, callback: LoadByHostCallback) => void

  export type RemoveAllCallback = (err: Error) => void
  export type RemoveAll = (callback: RemoveAllCallback) => void

  export type UpdatePodsScore = (goodPods: number[], badPods: number[]) => void
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
