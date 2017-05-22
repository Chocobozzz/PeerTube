import * as Sequelize from 'sequelize'

export namespace OAuthClientMethods {
  export type CountTotal = (callback) => void
  export type LoadFirstClient = (callback) => void
  export type GetByIdAndSecret = (clientId, clientSecret) => void
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
