import * as Sequelize from 'sequelize'
import * as Promise from 'bluebird'

// Don't use barrel, import just what we need
import { Pod as FormattedPod } from '../../../shared/models/pods/pod.model'

export namespace PodMethods {
  export type ToFormattedJSON = (this: PodInstance) => FormattedPod

  export type CountAll = () => Promise<number>

  export type IncrementScores = (ids: number[], value: number) => Promise<[ number, PodInstance[] ]>

  export type List = () => Promise<PodInstance[]>

  export type ListAllIds = (transaction: Sequelize.Transaction) => Promise<number[]>

  export type ListRandomPodIdsWithRequest = (limit: number, tableWithPods: string, tableWithPodsJoins: string) => Promise<number[]>

  export type ListBadPods = () => Promise<PodInstance[]>

  export type Load = (id: number) => Promise<PodInstance>

  export type LoadByHost = (host: string) => Promise<PodInstance>

  export type RemoveAll = () => Promise<number>

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
  id?: number
  host?: string
  publicKey?: string
  score?: number | Sequelize.literal // Sequelize literal for 'score +' + value
  email?: string
}

export interface PodInstance extends PodClass, PodAttributes, Sequelize.Instance<PodAttributes> {
  createdAt: Date
  updatedAt: Date

  toFormattedJSON: PodMethods.ToFormattedJSON,
}

export interface PodModel extends PodClass, Sequelize.Model<PodInstance, PodAttributes> {}
