import { values } from 'lodash'
import { Transaction } from 'sequelize'
import { AllowNull, BelongsTo, Column, CreatedAt, DataType, ForeignKey, Model, Table, UpdatedAt } from 'sequelize-typescript'
import { IFindOptions } from 'sequelize-typescript/lib/interfaces/IFindOptions'
import { VideoRateType } from '../../../shared/models/videos'
import { VIDEO_RATE_TYPES } from '../../initializers'
import { VideoModel } from '../video/video'
import { AccountModel } from './account'
import { ActorModel } from '../activitypub/actor'

/*
  Account rates per video.
*/
@Table({
  tableName: 'accountVideoRate',
  indexes: [
    {
      fields: [ 'videoId', 'accountId' ],
      unique: true
    }
  ]
})
export class AccountVideoRateModel extends Model<AccountVideoRateModel> {

  @AllowNull(false)
  @Column(DataType.ENUM(values(VIDEO_RATE_TYPES)))
  type: VideoRateType

  @CreatedAt
  createdAt: Date

  @UpdatedAt
  updatedAt: Date

  @ForeignKey(() => VideoModel)
  @Column
  videoId: number

  @BelongsTo(() => VideoModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'CASCADE'
  })
  Video: VideoModel

  @ForeignKey(() => AccountModel)
  @Column
  accountId: number

  @BelongsTo(() => AccountModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'CASCADE'
  })
  Account: AccountModel

  static load (accountId: number, videoId: number, transaction: Transaction) {
    const options: IFindOptions<AccountVideoRateModel> = {
      where: {
        accountId,
        videoId
      }
    }
    if (transaction) options.transaction = transaction

    return AccountVideoRateModel.findOne(options)
  }

  static listAndCountAccountUrlsByVideoId (rateType: VideoRateType, videoId: number, start: number, count: number, t?: Transaction) {
    const query = {
      start,
      count,
      where: {
        videoId,
        type: rateType
      },
      transaction: t,
      include: [
        {
          attributes: [ 'actorId' ],
          model: AccountModel.unscoped(),
          required: true,
          include: [
            {
              attributes: [ 'url' ],
              model: ActorModel.unscoped(),
              required: true
            }
          ]
        }
      ]
    }

    return AccountVideoRateModel.findAndCountAll(query)
  }
}
