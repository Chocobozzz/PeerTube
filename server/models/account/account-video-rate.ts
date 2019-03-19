import { values } from 'lodash'
import { Transaction, Op } from 'sequelize'
import { AllowNull, BelongsTo, Column, CreatedAt, DataType, ForeignKey, Is, Model, Table, UpdatedAt } from 'sequelize-typescript'
import { IFindOptions } from 'sequelize-typescript/lib/interfaces/IFindOptions'
import { VideoRateType } from '../../../shared/models/videos'
import { CONSTRAINTS_FIELDS, VIDEO_RATE_TYPES } from '../../initializers'
import { VideoModel } from '../video/video'
import { AccountModel } from './account'
import { ActorModel } from '../activitypub/actor'
import { throwIfNotValid } from '../utils'
import { isActivityPubUrlValid } from '../../helpers/custom-validators/activitypub/misc'

/*
  Account rates per video.
*/
@Table({
  tableName: 'accountVideoRate',
  indexes: [
    {
      fields: [ 'videoId', 'accountId' ],
      unique: true
    },
    {
      fields: [ 'videoId' ]
    },
    {
      fields: [ 'accountId' ]
    },
    {
      fields: [ 'videoId', 'type' ]
    },
    {
      fields: [ 'url' ],
      unique: true
    }
  ]
})
export class AccountVideoRateModel extends Model<AccountVideoRateModel> {

  @AllowNull(false)
  @Column(DataType.ENUM(values(VIDEO_RATE_TYPES)))
  type: VideoRateType

  @AllowNull(false)
  @Is('AccountVideoRateUrl', value => throwIfNotValid(value, isActivityPubUrlValid, 'url'))
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.VIDEO_RATES.URL.max))
  url: string

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

  static load (accountId: number, videoId: number, transaction?: Transaction) {
    const options: IFindOptions<AccountVideoRateModel> = {
      where: {
        accountId,
        videoId
      }
    }
    if (transaction) options.transaction = transaction

    return AccountVideoRateModel.findOne(options)
  }

  static loadLocalAndPopulateVideo (rateType: VideoRateType, accountName: string, videoId: number, transaction?: Transaction) {
    const options: IFindOptions<AccountVideoRateModel> = {
      where: {
        videoId,
        type: rateType
      },
      include: [
        {
          model: AccountModel.unscoped(),
          required: true,
          include: [
            {
              attributes: [ 'id', 'url', 'preferredUsername' ],
              model: ActorModel.unscoped(),
              required: true,
              where: {
                preferredUsername: accountName
              }
            }
          ]
        },
        {
          model: VideoModel.unscoped(),
          required: true
        }
      ]
    }
    if (transaction) options.transaction = transaction

    return AccountVideoRateModel.findOne(options)
  }

  static loadByUrl (url: string, transaction: Transaction) {
    const options: IFindOptions<AccountVideoRateModel> = {
      where: {
        url
      }
    }
    if (transaction) options.transaction = transaction

    return AccountVideoRateModel.findOne(options)
  }

  static listAndCountAccountUrlsByVideoId (rateType: VideoRateType, videoId: number, start: number, count: number, t?: Transaction) {
    const query = {
      offset: start,
      limit: count,
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

  static cleanOldRatesOf (videoId: number, type: VideoRateType, beforeUpdatedAt: Date) {
    return AccountVideoRateModel.sequelize.transaction(async t => {
      const query = {
        where: {
          updatedAt: {
            [Op.lt]: beforeUpdatedAt
          },
          videoId,
          type
        },
        transaction: t
      }

      const deleted = await AccountVideoRateModel.destroy(query)

      const options = {
        transaction: t,
        where: {
          id: videoId
        }
      }

      if (type === 'like') await VideoModel.increment({ likes: -deleted }, options)
      else if (type === 'dislike') await VideoModel.increment({ dislikes: -deleted }, options)
    })
  }
}
