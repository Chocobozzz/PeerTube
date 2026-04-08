import { VideoChangeOwnership, VideoChangeOwnershipStatus, type VideoChangeOwnershipStatusType } from '@peertube/peertube-models'
import { MVideoChangeOwnership, MVideoChangeOwnershipFull } from '@server/types/models/video/video-change-ownership.js'
import { AllowNull, BelongsTo, Column, CreatedAt, ForeignKey, Table, UpdatedAt } from 'sequelize-typescript'
import { AccountModel } from '../account/account.js'
import { SequelizeModel, buildSQLAttributes } from '../shared/index.js'
import {
  ListVideoChangeOwnershipOptions,
  VideoChangeOwnershipListQueryBuilder
} from './sql/change-ownership/video-change-ownership-list-query-builder.js'
import { VideoModel } from './video.js'

@Table({
  tableName: 'videoChangeOwnership',
  indexes: [
    {
      fields: [ 'videoId' ]
    },
    {
      fields: [ 'initiatorAccountId' ]
    },
    {
      fields: [ 'nextOwnerAccountId' ]
    }
  ]
})
export class VideoChangeOwnershipModel extends SequelizeModel<VideoChangeOwnershipModel> {
  @CreatedAt
  declare createdAt: Date

  @UpdatedAt
  declare updatedAt: Date

  @AllowNull(false)
  @Column
  declare status: VideoChangeOwnershipStatusType

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
      allowNull: false
    },
    onDelete: 'cascade'
  })
  declare Video: Awaited<VideoModel>

  static getSQLAttributes (tableName: string, aliasPrefix = '') {
    return buildSQLAttributes({
      model: this,
      tableName,
      aliasPrefix
    })
  }

  // ---------------------------------------------------------------------------

  static listForApi (options: ListVideoChangeOwnershipOptions) {
    return Promise.all([
      new VideoChangeOwnershipListQueryBuilder(VideoChangeOwnershipModel.sequelize, options).list<MVideoChangeOwnershipFull>(),
      new VideoChangeOwnershipListQueryBuilder(VideoChangeOwnershipModel.sequelize, options).count()
    ]).then(([ rows, total ]) => ({ total, data: rows }))
  }

  static load (id: number): Promise<MVideoChangeOwnershipFull> {
    return new VideoChangeOwnershipListQueryBuilder(VideoChangeOwnershipModel.sequelize, { id }).get<MVideoChangeOwnershipFull>()
  }

  static loadPendingByVideo (videoId: number): Promise<MVideoChangeOwnership> {
    return new VideoChangeOwnershipListQueryBuilder(VideoChangeOwnershipModel.sequelize, {
      videoId,
      state: VideoChangeOwnershipStatus.WAITING
    }).get<MVideoChangeOwnershipFull>()
  }

  // ---------------------------------------------------------------------------

  toFormattedJSON (this: MVideoChangeOwnershipFull): VideoChangeOwnership {
    return {
      id: this.id,
      status: this.status,
      initiatorAccount: this.Initiator.toFormattedJSON(),
      nextOwnerAccount: this.NextOwner.toFormattedJSON(),
      video: this.Video.toFormattedJSON(),
      createdAt: this.createdAt
    }
  }
}
