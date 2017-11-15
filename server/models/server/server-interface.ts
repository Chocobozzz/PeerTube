import * as Sequelize from 'sequelize'
import * as Promise from 'bluebird'

// Don't use barrel, import just what we need
import { ResultList } from '../../../shared/models/result-list.model'

export namespace ServerMethods {
  export type CountAll = () => Promise<number>

  export type IncrementScores = (ids: number[], value: number) => Promise<[ number, ServerInstance[] ]>

  export type List = () => Promise<ServerInstance[]>

  export type ListForApi = (start: number, count: number, sort: string) => Promise< ResultList<ServerInstance> >

  export type ListAllIds = (transaction: Sequelize.Transaction) => Promise<number[]>

  export type ListRandomServerIdsWithRequest = (limit: number, tableWithServers: string, tableWithServersJoins: string) => Promise<number[]>

  export type ListBadServers = () => Promise<ServerInstance[]>

  export type Load = (id: number) => Promise<ServerInstance>

  export type LoadByHost = (host: string) => Promise<ServerInstance>

  export type RemoveAll = () => Promise<number>

  export type UpdateServersScore = (goodServers: number[], badServers: number[]) => void
}

export interface ServerClass {
  countAll: ServerMethods.CountAll
  incrementScores: ServerMethods.IncrementScores
  list: ServerMethods.List
  listForApi: ServerMethods.ListForApi
  listAllIds: ServerMethods.ListAllIds
  listRandomServerIdsWithRequest: ServerMethods.ListRandomServerIdsWithRequest
  listBadServers: ServerMethods.ListBadServers
  load: ServerMethods.Load
  loadByHost: ServerMethods.LoadByHost
  removeAll: ServerMethods.RemoveAll
  updateServersScore: ServerMethods.UpdateServersScore
}

export interface ServerAttributes {
  id?: number
  host?: string
  score?: number | Sequelize.literal // Sequelize literal for 'score +' + value
}

export interface ServerInstance extends ServerClass, ServerAttributes, Sequelize.Instance<ServerAttributes> {
  createdAt: Date
  updatedAt: Date
}

export interface ServerModel extends ServerClass, Sequelize.Model<ServerInstance, ServerAttributes> {}
