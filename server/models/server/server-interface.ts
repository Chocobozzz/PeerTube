import * as Promise from 'bluebird'
import * as Sequelize from 'sequelize'

export namespace ServerMethods {
  export type ListBadServers = () => Promise<ServerInstance[]>
  export type UpdateServersScoreAndRemoveBadOnes = (goodServers: number[], badServers: number[]) => void
}

export interface ServerClass {
  updateServersScoreAndRemoveBadOnes: ServerMethods.UpdateServersScoreAndRemoveBadOnes
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
