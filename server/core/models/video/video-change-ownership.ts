import { VideoChangeOwnership, type VideoChangeOwnershipStatusType } from '@peertube/peertube-models'
import { MVideoChangeOwnershipFormattable, MVideoChangeOwnershipFull } from '@server/types/models/video/video-change-ownership.js'
import { AllowNull, BelongsTo, Column, CreatedAt, ForeignKey, Scopes, Table, UpdatedAt } from 'sequelize-typescript'
import { AccountModel } from '../account/account.js'
import { SequelizeModel, getSort } from '../shared/index.js'
import { VideoModel, ScopeNames as VideoScopeNames } from './video.js'

enum ScopeNames {
  WITH_ACCOUNTS = 'WITH_ACCOUNTS',
  WITH_VIDEO = 'WITH_VIDEO'
}

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
@Scopes(() => ({
  [ScopeNames.WITH_ACCOUNTS]: {
    include: [
      {
        model: AccountModel,
        as: 'Initiator',
        required: true
      },
      {
        model: AccountModel,
        as: 'NextOwner',
        required: true
      }
    ]
  },
  [ScopeNames.WITH_VIDEO]: {
    include: [
      {
        model: VideoModel.scope([
          VideoScopeNames.WITH_THUMBNAILS,
          VideoScopeNames.WITH_WEB_VIDEO_FILES,
          VideoScopeNames.WITH_STREAMING_PLAYLISTS,
          VideoScopeNames.WITH_ACCOUNT_DETAILS
        ]),
        required: true
      }
    ]
  }
}))
export class VideoChangeOwnershipModel extends SequelizeModel<VideoChangeOwnershipModel> {
  @CreatedAt
  createdAt: Date

  @UpdatedAt
  updatedAt: Date

  @AllowNull(false)
  @Column
  status: VideoChangeOwnershipStatusType

  @ForeignKey(() => AccountModel)
  @Column
  initiatorAccountId: number

  @BelongsTo(() => AccountModel, {
    foreignKey: {
      name: 'initiatorAccountId',
      allowNull: false
    },
    onDelete: 'cascade'
  })
  Initiator: Awaited<AccountModel>

  @ForeignKey(() => AccountModel)
  @Column
  nextOwnerAccountId: number

  @BelongsTo(() => AccountModel, {
    foreignKey: {
      name: 'nextOwnerAccountId',
      allowNull: false
    },
    onDelete: 'cascade'
  })
  NextOwner: Awaited<AccountModel>

  @ForeignKey(() => VideoModel)
  @Column
  videoId: number

  @BelongsTo(() => VideoModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'cascade'
  })
  Video: Awaited<VideoModel>

  static listForApi (nextOwnerId: number, start: number, count: number, sort: string) {
    const query = {
      offset: start,
      limit: count,
      order: getSort(sort),
      where: {
        nextOwnerAccountId: nextOwnerId
      }
    }

    return Promise.all([
      VideoChangeOwnershipModel.scope(ScopeNames.WITH_ACCOUNTS).count(query),
      VideoChangeOwnershipModel.scope([ ScopeNames.WITH_ACCOUNTS, ScopeNames.WITH_VIDEO ]).findAll<MVideoChangeOwnershipFull>(query)
    ]).then(([ count, rows ]) => ({ total: count, data: rows }))
  }

  static load (id: number): Promise<MVideoChangeOwnershipFull> {
    return VideoChangeOwnershipModel.scope([ ScopeNames.WITH_ACCOUNTS, ScopeNames.WITH_VIDEO ])
                                    .findByPk(id)
  }

  toFormattedJSON (this: MVideoChangeOwnershipFormattable): VideoChangeOwnership {
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
