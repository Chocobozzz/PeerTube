import {
  VideoChannelCollaboratorState,
  type VideoChannelCollaborator,
  type VideoChannelCollaboratorStateType
} from '@peertube/peertube-models'
import { CHANNEL_COLLABORATOR_STATE } from '@server/initializers/constants.js'
import { MChannelCollaboratorAccount, MChannelId, MUserId } from '@server/types/models/index.js'
import { AllowNull, BelongsTo, Column, CreatedAt, ForeignKey, Scopes, Table, UpdatedAt } from 'sequelize-typescript'
import { AccountModel } from '../account/account.js'
import { ActorModel } from '../actor/actor.js'
import { SequelizeModel, buildSQLAttributes, doesExist, getSort } from '../shared/index.js'
import { VideoChannelModel } from './video-channel.js'
import { Op } from 'sequelize'

enum ScopeNames {
  WITH_ACCOUNT = 'WITH_ACCOUNT'
}

@Table({
  tableName: 'videoChannelCollaborator',
  indexes: [
    {
      fields: [ 'channelId', 'accountId' ],
      unique: true
    }
  ]
})
@Scopes(() => ({
  [ScopeNames.WITH_ACCOUNT]: {
    include: [
      {
        model: AccountModel,
        required: true
      }
    ]
  }
}))
export class VideoChannelCollaboratorModel extends SequelizeModel<VideoChannelCollaboratorModel> {
  @CreatedAt
  declare createdAt: Date

  @UpdatedAt
  declare updatedAt: Date

  @AllowNull(false)
  @Column
  declare state: VideoChannelCollaboratorStateType

  @ForeignKey(() => AccountModel)
  @Column
  declare accountId: number

  @BelongsTo(() => AccountModel, {
    foreignKey: {
      name: 'accountId',
      allowNull: false
    },
    onDelete: 'cascade'
  })
  declare Account: Awaited<AccountModel>

  @ForeignKey(() => AccountModel)
  @Column
  declare channelId: number

  @BelongsTo(() => VideoChannelModel, {
    foreignKey: {
      name: 'channelId',
      allowNull: false
    },
    onDelete: 'cascade'
  })
  declare Channel: Awaited<VideoChannelModel>

  // ---------------------------------------------------------------------------

  static getSQLAttributes (tableName: string, aliasPrefix = '') {
    return buildSQLAttributes({
      model: this,
      tableName,
      aliasPrefix
    })
  }

  // ---------------------------------------------------------------------------

  static listForApi (options: {
    channelId: number
    start: number
    count: number
    sort: string
  }) {
    const { channelId, start, count, sort } = options

    const query = {
      offset: start,
      limit: count,
      order: getSort(sort),
      where: {
        channelId,
        state: {
          [Op.ne]: VideoChannelCollaboratorState.REJECTED
        }
      }
    }

    return Promise.all([
      VideoChannelCollaboratorModel.count(query),
      VideoChannelCollaboratorModel.scope([ ScopeNames.WITH_ACCOUNT ]).findAll<MChannelCollaboratorAccount>(query)
    ]).then(([ count, rows ]) => ({ total: count, data: rows }))
  }

  static countByChannel (channelId: number): Promise<number> {
    const query = {
      where: {
        channelId
      }
    }

    return VideoChannelCollaboratorModel.count(query)
  }

  static loadByChannelHandle (id: number, channelHandle: string): Promise<MChannelCollaboratorAccount> {
    return VideoChannelCollaboratorModel
      .scope([ ScopeNames.WITH_ACCOUNT ])
      .findOne({
        where: { id },
        include: [
          {
            model: VideoChannelModel.unscoped(),
            attributes: [ 'id' ],
            required: true,
            include: [
              {
                model: ActorModel.unscoped(),
                required: true,
                where: {
                  preferredUsername: channelHandle
                }
              }
            ]
          }
        ]
      })
  }

  static loadByCollaboratorAccountName (options: {
    channelId: number
    accountName: string
  }): Promise<MChannelCollaboratorAccount | null> {
    const { channelId, accountName } = options

    return VideoChannelCollaboratorModel.findOne({
      where: {
        channelId
      },
      include: [
        {
          model: AccountModel.unscoped(),
          required: true,
          include: [
            {
              model: ActorModel.unscoped(),
              required: true,
              where: {
                preferredUsername: accountName
              }
            }
          ]
        }
      ]
    })
  }

  static async isCollaborator (options: {
    user: MUserId
    channel: MChannelId
  }): Promise<boolean> {
    const { user, channel } = options

    const query = `SELECT 1 FROM "videoChannelCollaborator" ` +
      `INNER JOIN "account" ON "account"."id" = "videoChannelCollaborator"."accountId" AND account."userId" = $userId ` +
      `WHERE "videoChannelCollaborator"."channelId" = $channelId AND "state" = $state ` +
      `LIMIT 1`

    return doesExist({
      sequelize: this.sequelize,
      query,
      bind: { userId: user.id, channelId: channel.id, state: VideoChannelCollaboratorState.ACCEPTED }
    })
  }

  // ---------------------------------------------------------------------------

  static getStateLabel (state: VideoChannelCollaboratorStateType) {
    return CHANNEL_COLLABORATOR_STATE[state]
  }

  toFormattedJSON (this: MChannelCollaboratorAccount): VideoChannelCollaborator {
    return {
      id: this.id,

      state: {
        id: this.state,
        label: VideoChannelCollaboratorModel.getStateLabel(this.state)
      },

      account: this.Account.toFormattedJSON(),
      updatedAt: this.updatedAt.toISOString(),
      createdAt: this.createdAt.toISOString()
    }
  }
}
