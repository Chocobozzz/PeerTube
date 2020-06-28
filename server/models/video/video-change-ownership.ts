import { AllowNull, BelongsTo, Column, CreatedAt, ForeignKey, Model, Scopes, Table, UpdatedAt } from 'sequelize-typescript'
import { AccountModel } from '../account/account'
import { ScopeNames as VideoScopeNames, VideoModel } from './video'
import { VideoChangeOwnership, VideoChangeOwnershipStatus } from '../../../shared/models/videos'
import { getSort } from '../utils'
import { MVideoChangeOwnershipFormattable, MVideoChangeOwnershipFull } from '@server/types/models/video/video-change-ownership'
import * as Bluebird from 'bluebird'

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
          VideoScopeNames.WITH_WEBTORRENT_FILES,
          VideoScopeNames.WITH_STREAMING_PLAYLISTS,
          VideoScopeNames.WITH_ACCOUNT_DETAILS
        ]),
        required: true
      }
    ]
  }
}))
export class VideoChangeOwnershipModel extends Model<VideoChangeOwnershipModel> {
  @CreatedAt
  createdAt: Date

  @UpdatedAt
  updatedAt: Date

  @AllowNull(false)
  @Column
  status: VideoChangeOwnershipStatus

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
  Initiator: AccountModel

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
  NextOwner: AccountModel

  @ForeignKey(() => VideoModel)
  @Column
  videoId: number

  @BelongsTo(() => VideoModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'cascade'
  })
  Video: VideoModel

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

  static load (id: number): Bluebird<MVideoChangeOwnershipFull> {
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
