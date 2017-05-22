import * as Sequelize from 'sequelize'

import { UserModel } from './user-interface'

export namespace OAuthTokenMethods {
  export type GetByRefreshTokenAndPopulateClient = (refreshToken) => void
  export type GetByTokenAndPopulateUser = (bearerToken) => void
  export type GetByRefreshTokenAndPopulateUser = (refreshToken) => any
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
