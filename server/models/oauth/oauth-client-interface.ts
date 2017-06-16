import * as Sequelize from 'sequelize'

export namespace OAuthClientMethods {
  export type CountTotalCallback = (err: Error, total: number) => void
  export type CountTotal = (callback: CountTotalCallback) => void

  export type LoadFirstClientCallback = (err: Error, client: OAuthClientInstance) => void
  export type LoadFirstClient = (callback: LoadFirstClientCallback) => void

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
