import * as Sequelize from 'sequelize'
import { BelongsTo, Column, CreatedAt, ForeignKey, Model, Scopes, Table, UpdatedAt } from 'sequelize-typescript'
import { AccountModel } from '../account/account'
import { VideoChannelModel } from './video-channel'

enum ScopeNames {
  FULL = 'FULL',
  WITH_ACCOUNT = 'WITH_ACCOUNT'
}

@Scopes({
  [ScopeNames.FULL]: {
    include: [
      {
        model: () => AccountModel,
        required: true
      },
      {
        model: () => VideoChannelModel,
        required: true
      }
    ]
  },
  [ScopeNames.WITH_ACCOUNT]: {
    include: [
      {
        model: () => AccountModel,
        required: true
      }
    ]
  }
})
@Table({
  tableName: 'videoChannelShare',
  indexes: [
    {
      fields: [ 'accountId' ]
    },
    {
      fields: [ 'videoChannelId' ]
    }
  ]
})
export class VideoChannelShareModel extends Model<VideoChannelShareModel> {
  @CreatedAt
  createdAt: Date

  @UpdatedAt
  updatedAt: Date

  @ForeignKey(() => AccountModel)
  @Column
  accountId: number

  @BelongsTo(() => AccountModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'cascade'
  })
  Account: AccountModel

  @ForeignKey(() => VideoChannelModel)
  @Column
  videoChannelId: number

  @BelongsTo(() => VideoChannelModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'cascade'
  })
  VideoChannel: VideoChannelModel

  static load (accountId: number, videoChannelId: number, t: Sequelize.Transaction) {
    return VideoChannelShareModel.scope(ScopeNames.FULL).findOne({
      where: {
        accountId,
        videoChannelId
      },
      transaction: t
    })
  }

  static loadAccountsByShare (videoChannelId: number, t: Sequelize.Transaction) {
    const query = {
      where: {
        videoChannelId
      },
      transaction: t
    }

    return VideoChannelShareModel.scope(ScopeNames.WITH_ACCOUNT).findAll(query)
      .then(res => res.map(r => r.Account))
  }
}
