import {
  AfterDestroy,
  AfterUpdate,
  AllowNull,
  BelongsTo,
  Column,
  CreatedAt,
  ForeignKey,
  Model,
  Scopes,
  Table,
  UpdatedAt
} from 'sequelize-typescript'
import { logger } from '../../helpers/logger'
import { UserModel } from '../account/user'
import { OAuthClientModel } from './oauth-client'
import { Transaction } from 'sequelize'
import { AccountModel } from '../account/account'
import { ActorModel } from '../activitypub/actor'
import { clearCacheByToken } from '../../lib/oauth-model'
import * as Bluebird from 'bluebird'
import { MOAuthTokenUser } from '@server/types/models/oauth/oauth-token'

export type OAuthTokenInfo = {
  refreshToken: string
  refreshTokenExpiresAt: Date
  client: {
    id: number
  }
  user: {
    id: number
  }
  token: MOAuthTokenUser
}

enum ScopeNames {
  WITH_USER = 'WITH_USER'
}

@Scopes(() => ({
  [ScopeNames.WITH_USER]: {
    include: [
      {
        model: UserModel.unscoped(),
        required: true,
        include: [
          {
            attributes: [ 'id' ],
            model: AccountModel.unscoped(),
            required: true,
            include: [
              {
                attributes: [ 'id', 'url' ],
                model: ActorModel.unscoped(),
                required: true
              }
            ]
          }
        ]
      }
    ]
  }
}))
@Table({
  tableName: 'oAuthToken',
  indexes: [
    {
      fields: [ 'refreshToken' ],
      unique: true
    },
    {
      fields: [ 'accessToken' ],
      unique: true
    },
    {
      fields: [ 'userId' ]
    },
    {
      fields: [ 'oAuthClientId' ]
    }
  ]
})
export class OAuthTokenModel extends Model<OAuthTokenModel> {

  @AllowNull(false)
  @Column
  accessToken: string

  @AllowNull(false)
  @Column
  accessTokenExpiresAt: Date

  @AllowNull(false)
  @Column
  refreshToken: string

  @AllowNull(false)
  @Column
  refreshTokenExpiresAt: Date

  @Column
  authName: string

  @CreatedAt
  createdAt: Date

  @UpdatedAt
  updatedAt: Date

  @ForeignKey(() => UserModel)
  @Column
  userId: number

  @BelongsTo(() => UserModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'cascade'
  })
  User: UserModel

  @ForeignKey(() => OAuthClientModel)
  @Column
  oAuthClientId: number

  @BelongsTo(() => OAuthClientModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'cascade'
  })
  OAuthClients: OAuthClientModel[]

  @AfterUpdate
  @AfterDestroy
  static removeTokenCache (token: OAuthTokenModel) {
    return clearCacheByToken(token.accessToken)
  }

  static loadByRefreshToken (refreshToken: string) {
    const query = {
      where: { refreshToken }
    }

    return OAuthTokenModel.findOne(query)
  }

  static getByRefreshTokenAndPopulateClient (refreshToken: string) {
    const query = {
      where: {
        refreshToken
      },
      include: [ OAuthClientModel ]
    }

    return OAuthTokenModel.scope(ScopeNames.WITH_USER)
                          .findOne(query)
                          .then(token => {
                            if (!token) return null

                            return {
                              refreshToken: token.refreshToken,
                              refreshTokenExpiresAt: token.refreshTokenExpiresAt,
                              client: {
                                id: token.oAuthClientId
                              },
                              user: token.User,
                              token
                            } as OAuthTokenInfo
                          })
                          .catch(err => {
                            logger.error('getRefreshToken error.', { err })
                            throw err
                          })
  }

  static getByTokenAndPopulateUser (bearerToken: string): Bluebird<MOAuthTokenUser> {
    const query = {
      where: {
        accessToken: bearerToken
      }
    }

    return OAuthTokenModel.scope(ScopeNames.WITH_USER)
                          .findOne(query)
                          .then(token => {
                            if (!token) return null

                            return Object.assign(token, { user: token.User })
                          })
  }

  static getByRefreshTokenAndPopulateUser (refreshToken: string): Bluebird<MOAuthTokenUser> {
    const query = {
      where: {
        refreshToken
      }
    }

    return OAuthTokenModel.scope(ScopeNames.WITH_USER)
      .findOne(query)
      .then(token => {
        if (!token) return undefined

        return Object.assign(token, { user: token.User })
      })
  }

  static deleteUserToken (userId: number, t?: Transaction) {
    const query = {
      where: {
        userId
      },
      transaction: t
    }

    return OAuthTokenModel.destroy(query)
  }
}
