import {
  AfterDelete,
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

enum ScopeNames {
  WITH_USER = 'WITH_USER'
}

@Scopes({
  [ScopeNames.WITH_USER]: {
    include: [
      {
        model: () => UserModel.unscoped(),
        required: true,
        include: [
          {
            attributes: [ 'id' ],
            model: () => AccountModel.unscoped(),
            required: true,
            include: [
              {
                attributes: [ 'id' ],
                model: () => ActorModel.unscoped(),
                required: true
              }
            ]
          }
        ]
      }
    ]
  }
})
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
  @AfterDelete
  static removeTokenCache (token: OAuthTokenModel) {
    return clearCacheByToken(token.accessToken)
  }

  static getByRefreshTokenAndPopulateClient (refreshToken: string) {
    const query = {
      where: {
        refreshToken: refreshToken
      },
      include: [ OAuthClientModel ]
    }

    return OAuthTokenModel.findOne(query)
      .then(token => {
        if (!token) return null

        return {
          refreshToken: token.refreshToken,
          refreshTokenExpiresAt: token.refreshTokenExpiresAt,
          client: {
            id: token.oAuthClientId
          },
          user: {
            id: token.userId
          }
        } as OAuthTokenInfo
      })
      .catch(err => {
        logger.error('getRefreshToken error.', { err })
        throw err
      })
  }

  static getByTokenAndPopulateUser (bearerToken: string) {
    const query = {
      where: {
        accessToken: bearerToken
      }
    }

    return OAuthTokenModel.scope(ScopeNames.WITH_USER).findOne(query).then(token => {
      if (token) token['user'] = token.User

      return token
    })
  }

  static getByRefreshTokenAndPopulateUser (refreshToken: string) {
    const query = {
      where: {
        refreshToken: refreshToken
      }
    }

    return OAuthTokenModel.scope(ScopeNames.WITH_USER)
      .findOne(query)
      .then(token => {
        if (token) {
          token['user'] = token.User
          return token
        } else {
          return new OAuthTokenModel()
        }
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
