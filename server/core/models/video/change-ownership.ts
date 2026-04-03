import { ChangeOwnership, ChangeOwnershipState, type ChangeOwnershipStateType } from '@peertube/peertube-models'
import { CHANGE_OWNERSHIP_STATES } from '@server/initializers/constants.js'
import { MChangeOwnership, MChangeOwnershipFull } from '@server/types/models/video/change-ownership.js'
import { AllowNull, BelongsTo, Column, CreatedAt, ForeignKey, Table, UpdatedAt } from 'sequelize-typescript'
import { AccountModel } from '../account/account.js'
import { SequelizeModel, buildSQLAttributes } from '../shared/index.js'
import { ChangeOwnershipListQueryBuilder, ListChangeOwnershipOptions } from './sql/change-ownership/change-ownership-list-query-builder.js'
import { VideoChannelModel } from './video-channel.js'
import { VideoModel } from './video.js'

@Table({
  tableName: 'changeOwnership',
  indexes: [
    {
      fields: [ 'videoId' ]
    },
    {
      fields: [ 'videoChannelId' ]
    },
    {
      fields: [ 'initiatorAccountId' ]
    },
    {
      fields: [ 'nextOwnerAccountId' ]
    }
  ]
})
export class ChangeOwnershipModel extends SequelizeModel<ChangeOwnershipModel> {
  @CreatedAt
  declare createdAt: Date

  @UpdatedAt
  declare updatedAt: Date

  @AllowNull(false)
  @Column
  declare state: ChangeOwnershipStateType

  @ForeignKey(() => AccountModel)
  @Column
  declare initiatorAccountId: number

  @BelongsTo(() => AccountModel, {
    foreignKey: {
      name: 'initiatorAccountId',
      allowNull: false
    },
    onDelete: 'cascade'
  })
  declare Initiator: Awaited<AccountModel>

  @ForeignKey(() => AccountModel)
  @Column
  declare nextOwnerAccountId: number

  @BelongsTo(() => AccountModel, {
    foreignKey: {
      name: 'nextOwnerAccountId',
      allowNull: false
    },
    onDelete: 'cascade'
  })
  declare NextOwner: Awaited<AccountModel>

  @ForeignKey(() => VideoModel)
  @Column
  declare videoId: number

  @BelongsTo(() => VideoModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'cascade'
  })
  declare Video: Awaited<VideoModel>

  @ForeignKey(() => VideoChannelModel)
  @Column
  declare videoChannelId: number

  @BelongsTo(() => VideoChannelModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'cascade'
  })
  declare VideoChannel: Awaited<VideoChannelModel>

  static getSQLAttributes (tableName: string, aliasPrefix = '') {
    return buildSQLAttributes({
      model: this,
      tableName,
      aliasPrefix
    })
  }

  // ---------------------------------------------------------------------------

  static load (id: number): Promise<MChangeOwnershipFull> {
    return new ChangeOwnershipListQueryBuilder(ChangeOwnershipModel.sequelize, { id }).get<MChangeOwnershipFull>()
  }

  // ---------------------------------------------------------------------------

  static listForVideoApi (options: ListChangeOwnershipOptions) {
    const queryOptions = { ...options, type: 'video' as const }

    return Promise.all([
      new ChangeOwnershipListQueryBuilder(ChangeOwnershipModel.sequelize, queryOptions).list<MChangeOwnershipFull>(),
      new ChangeOwnershipListQueryBuilder(ChangeOwnershipModel.sequelize, queryOptions).count()
    ]).then(([ rows, total ]) => ({ total, data: rows }))
  }

  static loadPendingByVideo (videoId: number): Promise<MChangeOwnership> {
    return new ChangeOwnershipListQueryBuilder(ChangeOwnershipModel.sequelize, {
      type: 'video',
      videoId,
      state: ChangeOwnershipState.PENDING
    }).get<MChangeOwnershipFull>()
  }

  // ---------------------------------------------------------------------------

  static listForChannelApi (options: ListChangeOwnershipOptions) {
    const queryOptions = { ...options, type: 'video-channel' as const }

    return Promise.all([
      new ChangeOwnershipListQueryBuilder(ChangeOwnershipModel.sequelize, queryOptions).list<MChangeOwnershipFull>(),
      new ChangeOwnershipListQueryBuilder(ChangeOwnershipModel.sequelize, queryOptions).count()
    ]).then(([ rows, total ]) => ({ total, data: rows }))
  }

  static loadPendingByChannel (videoChannelId: number): Promise<MChangeOwnership> {
    return new ChangeOwnershipListQueryBuilder(ChangeOwnershipModel.sequelize, {
      type: 'video-channel',
      videoChannelId,
      state: ChangeOwnershipState.PENDING
    }).get<MChangeOwnershipFull>()
  }

  // ---------------------------------------------------------------------------

  static getStateLabel (state: ChangeOwnershipStateType) {
    return CHANGE_OWNERSHIP_STATES[state]
  }

  // ---------------------------------------------------------------------------

  toFormattedJSON (this: MChangeOwnershipFull): ChangeOwnership {
    let status: ChangeOwnership['status']

    if (this.state === ChangeOwnershipState.PENDING) status = 'WAITING'
    else if (this.state === ChangeOwnershipState.ACCEPTED) status = 'ACCEPTED'
    else if (this.state === ChangeOwnershipState.REJECTED) status = 'REFUSED'

    return {
      id: this.id,

      state: {
        id: this.state,
        label: ChangeOwnershipModel.getStateLabel(this.state)
      },

      status,

      initiatorAccount: this.Initiator.toFormattedJSON(),
      nextOwnerAccount: this.NextOwner.toFormattedJSON(),

      video: this.Video?.toFormattedSummaryJSON(),
      videoChannel: this.VideoChannel?.toFormattedSummaryJSON(),

      createdAt: this.createdAt
    }
  }
}
