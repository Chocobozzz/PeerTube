import * as Sequelize from 'sequelize'
import { BelongsTo, Column, CreatedAt, ForeignKey, Model, Table, UpdatedAt } from 'sequelize-typescript'
import { AccountModel } from '../account/account'
import { VideoChannelModel } from './video-channel'

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
    return VideoChannelShareModel.findOne({
      where: {
        accountId,
        videoChannelId
      },
      include: [
        AccountModel,
        VideoChannelModel
      ],
      transaction: t
    })
  }

  static loadAccountsByShare (videoChannelId: number, t: Sequelize.Transaction) {
    const query = {
      where: {
        videoChannelId
      },
      include: [
        {
          model: AccountModel,
          required: true
        }
      ],
      transaction: t
    }

    return VideoChannelShareModel.findAll(query)
      .then(res => res.map(r => r.Account))
  }
}
