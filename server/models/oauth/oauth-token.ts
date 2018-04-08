import { AllowNull, BelongsTo, Column, CreatedAt, ForeignKey, Model, Scopes, Table, UpdatedAt } from 'sequelize-typescript'
import { logger } from '../../helpers/logger'
import { AccountModel } from '../account/account'
import { UserModel } from '../account/user'
import { OAuthClientModel } from './oauth-client'

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
  WITH_ACCOUNT = 'WITH_ACCOUNT'
}

@Scopes({
  [ScopeNames.WITH_ACCOUNT]: {
    include: [
      {
        model: () => UserModel,
        include: [
          {
            model: () => AccountModel,
            required: true
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
        logger.info('getRefreshToken error.', { err })
        throw err
      })
  }

  static getByTokenAndPopulateUser (bearerToken: string) {
    const query = {
      where: {
        accessToken: bearerToken
      }
    }

    return OAuthTokenModel.scope(ScopeNames.WITH_ACCOUNT).findOne(query).then(token => {
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

    return OAuthTokenModel.scope(ScopeNames.WITH_ACCOUNT)
      .findOne(query)
      .then(token => {
        token['user'] = token.User

        return token
      })
  }

  static deleteUserToken (userId: number) {
    const query = {
      where: {
        userId
      }
    }

    return OAuthTokenModel.destroy(query)
  }
}
