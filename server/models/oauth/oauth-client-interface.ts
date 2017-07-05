import * as Sequelize from 'sequelize'
import * as Promise from 'bluebird'

export namespace OAuthClientMethods {
  export type CountTotal = () => Promise<number>

  export type LoadFirstClient = () => Promise<OAuthClientInstance>

  export type GetByIdAndSecret = (clientId: string, clientSecret: string) => Promise<OAuthClientInstance>
}

export interface OAuthClientClass {
  countTotal: OAuthClientMethods.CountTotal
  loadFirstClient: OAuthClientMethods.LoadFirstClient
  getByIdAndSecret: OAuthClientMethods.GetByIdAndSecret
}

export interface OAuthClientAttributes {
  clientId: string
  clientSecret: string
  grants: string[]
  redirectUris: string[]
}

export interface OAuthClientInstance extends OAuthClientClass, OAuthClientAttributes, Sequelize.Instance<OAuthClientAttributes> {
  id: number
  createdAt: Date
  updatedAt: Date
}

export interface OAuthClientModel extends OAuthClientClass, Sequelize.Model<OAuthClientInstance, OAuthClientAttributes> {}
