import { TokenSession } from '@peertube/peertube-models'
import { TokensCache } from '@server/lib/auth/tokens-cache.js'
import { MUserAccountId } from '@server/types/models/index.js'
import { MOAuthTokenUser } from '@server/types/models/oauth/oauth-token.js'
import { Op, Transaction } from 'sequelize'
import {
  AfterDestroy,
  AfterUpdate,
  AllowNull,
  BelongsTo,
  Column,
  CreatedAt,
  ForeignKey,
  Scopes,
  Table,
  UpdatedAt
} from 'sequelize-typescript'
import { logger } from '../../helpers/logger.js'
import { AccountModel } from '../account/account.js'
import { ActorModel } from '../actor/actor.js'
import { getSort, SequelizeModel } from '../shared/index.js'
import { UserModel } from '../user/user.js'
import { OAuthClientModel } from './oauth-client.js'

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
  declare accessToken: string

  @AllowNull(false)
  @Column
  declare accessTokenExpiresAt: Date

  @AllowNull(false)
  @Column
  declare refreshToken: string

  @AllowNull(false)
  @Column
  declare refreshTokenExpiresAt: Date

  @Column
  declare authName: string

  @Column
  declare loginDevice: string

  @Column
  declare loginIP: string

  @Column
  declare loginDate: Date

  @Column
  declare lastActivityDevice: string

  @Column
  declare lastActivityIP: string

  @Column
  declare lastActivityDate: Date

  @CreatedAt
  declare createdAt: Date

  @UpdatedAt
  declare updatedAt: Date

  @ForeignKey(() => UserModel)
  @Column
  declare userId: number

  @BelongsTo(() => UserModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'cascade'
  })
  declare User: Awaited<UserModel>

  @ForeignKey(() => OAuthClientModel)
  @Column
  declare oAuthClientId: number

  @BelongsTo(() => OAuthClientModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'cascade'
  })
  declare OAuthClients: Awaited<OAuthClientModel>[]

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

  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------

  static loadSessionOf (options: {
    id: number
    userId: number
  }) {
    const now = new Date()

    return OAuthTokenModel.findOne({
      where: {
        id: options.id,
        userId: options.userId,
        accessTokenExpiresAt: {
          [Op.gt]: now
        },
        refreshTokenExpiresAt: {
          [Op.gt]: now
        }
      }
    })
  }

  static async listSessionsOf (options: {
    start: number
    count: number
    sort: string
    userId: number
  }) {
    const now = new Date()

    const { count, rows } = await OAuthTokenModel.findAndCountAll({
      offset: options.start,
      limit: options.count,
      order: getSort(options.sort),
      where: {
        userId: options.userId,
        accessTokenExpiresAt: {
          [Op.gt]: now
        },
        refreshTokenExpiresAt: {
          [Op.gt]: now
        }
      }
    })

    return {
      total: count,
      data: rows
    }
  }

  // ---------------------------------------------------------------------------

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

  toSessionFormattedJSON (activeToken: string): TokenSession {
    return {
      id: this.id,

      loginIP: this.loginIP,
      loginDevice: this.loginDevice,
      loginDate: this.loginDate,

      lastActivityIP: this.lastActivityIP,
      lastActivityDevice: this.lastActivityDevice,
      lastActivityDate: this.lastActivityDate,

      currentSession: this.accessToken === activeToken,

      createdAt: this.createdAt
    }
  }
}
