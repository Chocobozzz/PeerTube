import * as Sequelize from 'sequelize'
import { BelongsTo, Column, CreatedAt, ForeignKey, Model, Scopes, Table, UpdatedAt } from 'sequelize-typescript'
import { AccountModel } from '../account/account'
import { VideoModel } from './video'

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
        model: () => VideoModel,
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
  tableName: 'videoShare',
  indexes: [
    {
      fields: [ 'accountId' ]
    },
    {
      fields: [ 'videoId' ]
    }
  ]
})
export class VideoShareModel extends Model<VideoShareModel> {
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

  static load (accountId: number, videoId: number, t: Sequelize.Transaction) {
    return VideoShareModel.scope(ScopeNames.WITH_ACCOUNT).findOne({
      where: {
        accountId,
        videoId
      },
      transaction: t
    })
  }

  static loadAccountsByShare (videoId: number, t: Sequelize.Transaction) {
    const query = {
      where: {
        videoId
      },
      include: [
        {
          model: AccountModel,
          required: true
        }
      ],
      transaction: t
    }

    return VideoShareModel.scope(ScopeNames.FULL).findAll(query)
      .then(res => res.map(r => r.Account))
  }
}
