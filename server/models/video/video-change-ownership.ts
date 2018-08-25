import { BelongsTo, Column, CreatedAt, ForeignKey, Model, Scopes, Table, UpdatedAt } from 'sequelize-typescript'
import { AccountModel } from '../account/account'
import { VideoModel } from './video'
import { VideoChangeOwnership, VideoChangeOwnershipStatus } from '../../../shared/models/videos'
import { getSort } from '../utils'
import { VideoFileModel } from './video-file'

enum ScopeNames {
  FULL = 'FULL'
}

@Table({
  tableName: 'videoChangeOwnership',
  indexes: [
    {
      fields: ['videoId']
    },
    {
      fields: ['initiatorAccountId']
    },
    {
      fields: ['nextOwnerAccountId']
    }
  ]
})
@Scopes({
  [ScopeNames.FULL]: {
    include: [
      {
        model: () => AccountModel,
        as: 'Initiator',
        required: true
      },
      {
        model: () => AccountModel,
        as: 'NextOwner',
        required: true
      },
      {
        model: () => VideoModel,
        required: true,
        include: [{ model: () => VideoFileModel }]
      }
    ]
  }
})
export class VideoChangeOwnershipModel extends Model<VideoChangeOwnershipModel> {
  @CreatedAt
  createdAt: Date

  @UpdatedAt
  updatedAt: Date

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
    return VideoChangeOwnershipModel.scope(ScopeNames.FULL).findAndCountAll({
      offset: start,
      limit: count,
      order: getSort(sort),
      where: {
        nextOwnerAccountId: nextOwnerId
      }
    })
      .then(({ rows, count }) => ({ total: count, data: rows }))
  }

  static load (id: number) {
    return VideoChangeOwnershipModel.scope(ScopeNames.FULL).find({
      where: {
        id: id
      }
    })
  }

  static findExisting(initiatorAccountId: number, nextOwnerAccountId: number, videoId: number) {
    return VideoChangeOwnershipModel.find({
      where: {
        initiatorAccountId,
        nextOwnerAccountId,
        videoId
      }
    })
  }

  toFormattedJSON (): VideoChangeOwnership {
    return {
      id: this.id,
      status: this.status,
      initiatorAccount: this.Initiator.toFormattedJSON(),
      nextOwnerAccount: this.NextOwner.toFormattedJSON(),
      video: {
        id: this.Video.id,
        uuid: this.Video.uuid,
        url: this.Video.url,
        name: this.Video.name
      },
      createdAt: this.createdAt
    }
  }
}
