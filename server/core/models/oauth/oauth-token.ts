import { Transaction } from 'sequelize'
import {
  AfterDestroy,
  AfterUpdate,
  AllowNull,
  BelongsTo,
  Column,
  CreatedAt,
  ForeignKey, Scopes,
  Table,
  UpdatedAt
} from 'sequelize-typescript'
import { TokensCache } from '@server/lib/auth/tokens-cache.js'
import { MUserAccountId } from '@server/types/models/index.js'
import { MOAuthTokenUser } from '@server/types/models/oauth/oauth-token.js'
import { logger } from '../../helpers/logger.js'
import { AccountModel } from '../account/account.js'
import { ActorModel } from '../actor/actor.js'
import { UserModel } from '../user/user.js'
import { OAuthClientModel } from './oauth-client.js'
import { SequelizeModel } from '../shared/index.js'

export type OAuthTokenInfo = {
  refreshToken: string
  refreshTokenExpiresAt: Date
  client: {
    id: number
    grants: string[]
  }
  user: MUserAccountId
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
export class OAuthTokenModel extends SequelizeModel<OAuthTokenModel> {

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
  User: Awaited<UserModel>

  @ForeignKey(() => OAuthClientModel)
  @Column
  oAuthClientId: number

  @BelongsTo(() => OAuthClientModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'cascade'
  })
  OAuthClients: Awaited<OAuthClientModel>[]

  @AfterUpdate
  @AfterDestroy
  static removeTokenCache (token: OAuthTokenModel) {
    return TokensCache.Instance.clearCacheByToken(token.accessToken)
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
                                id: token.oAuthClientId,
                                grants: []
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

  static getByTokenAndPopulateUser (bearerToken: string): Promise<MOAuthTokenUser> {
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

  static getByRefreshTokenAndPopulateUser (refreshToken: string): Promise<MOAuthTokenUser> {
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
    TokensCache.Instance.deleteUserToken(userId)

    const query = {
      where: {
        userId
      },
      transaction: t
    }

    return OAuthTokenModel.destroy(query)
  }
}
