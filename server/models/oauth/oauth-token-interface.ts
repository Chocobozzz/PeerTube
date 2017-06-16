import * as Sequelize from 'sequelize'
import * as Bluebird from 'bluebird'

import { UserModel } from '../user'

export type OAuthTokenInfo = {
  refreshToken: string
  refreshTokenExpiresAt: Date,
  client: {
    id: number
  },
  user: {
    id: number
  }
}

export namespace OAuthTokenMethods {
  export type GetByRefreshTokenAndPopulateClient = (refreshToken: string) => Bluebird<OAuthTokenInfo>
  export type GetByTokenAndPopulateUser = (bearerToken: string) => Bluebird<OAuthTokenInstance>
  export type GetByRefreshTokenAndPopulateUser = (refreshToken: string) => Bluebird<OAuthTokenInstance>

  export type RemoveByUserIdCallback = (err: Error) => void
  export type RemoveByUserId = (userId, callback) => void
}

export interface OAuthTokenClass {
  getByRefreshTokenAndPopulateClient: OAuthTokenMethods.GetByRefreshTokenAndPopulateClient
  getByTokenAndPopulateUser: OAuthTokenMethods.GetByTokenAndPopulateUser
  getByRefreshTokenAndPopulateUser: OAuthTokenMethods.GetByRefreshTokenAndPopulateUser
  removeByUserId: OAuthTokenMethods.RemoveByUserId
}

export interface OAuthTokenAttributes {
  accessToken: string
  accessTokenExpiresAt: Date
  refreshToken: string
  refreshTokenExpiresAt: Date

  User?: UserModel
}

export interface OAuthTokenInstance extends OAuthTokenClass, OAuthTokenAttributes, Sequelize.Instance<OAuthTokenAttributes> {
  id: number
  createdAt: Date
  updatedAt: Date
}

export interface OAuthTokenModel extends OAuthTokenClass, Sequelize.Model<OAuthTokenInstance, OAuthTokenAttributes> {}
