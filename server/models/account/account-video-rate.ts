import { values } from 'lodash'
import { FindOptions, Op, Transaction } from 'sequelize'
import { AllowNull, BelongsTo, Column, CreatedAt, DataType, ForeignKey, Is, Model, Table, UpdatedAt } from 'sequelize-typescript'
import { VideoRateType } from '../../../shared/models/videos'
import { CONSTRAINTS_FIELDS, VIDEO_RATE_TYPES } from '../../initializers/constants'
import { VideoModel } from '../video/video'
import { AccountModel } from './account'
import { ActorModel } from '../activitypub/actor'
import { buildLocalAccountIdsIn, getSort, throwIfNotValid } from '../utils'
import { isActivityPubUrlValid } from '../../helpers/custom-validators/activitypub/misc'
import { AccountVideoRate } from '../../../shared'
import { ScopeNames as VideoChannelScopeNames, SummaryOptions, VideoChannelModel } from '../video/video-channel'
import * as Bluebird from 'bluebird'
import {
  MAccountVideoRate,
  MAccountVideoRateAccountUrl,
  MAccountVideoRateAccountVideo,
  MAccountVideoRateFormattable
} from '@server/types/models/video/video-rate'

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
  @Column(DataType.ENUM(...values(VIDEO_RATE_TYPES)))
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

  static load (accountId: number, videoId: number, transaction?: Transaction): Bluebird<MAccountVideoRate> {
    const options: FindOptions = {
      where: {
        accountId,
        videoId
      }
    }
    if (transaction) options.transaction = transaction

    return AccountVideoRateModel.findOne(options)
  }

  static loadByAccountAndVideoOrUrl (accountId: number, videoId: number, url: string, t?: Transaction): Bluebird<MAccountVideoRate> {
    const options: FindOptions = {
      where: {
        [Op.or]: [
          {
            accountId,
            videoId
          },
          {
            url
          }
        ]
      }
    }
    if (t) options.transaction = t

    return AccountVideoRateModel.findOne(options)
  }

  static listByAccountForApi (options: {
    start: number
    count: number
    sort: string
    type?: string
    accountId: number
  }) {
    const query: FindOptions = {
      offset: options.start,
      limit: options.count,
      order: getSort(options.sort),
      where: {
        accountId: options.accountId
      },
      include: [
        {
          model: VideoModel,
          required: true,
          include: [
            {
              model: VideoChannelModel.scope({ method: [ VideoChannelScopeNames.SUMMARY, { withAccount: true } as SummaryOptions ] }),
              required: true
            }
          ]
        }
      ]
    }
    if (options.type) query.where['type'] = options.type

    return AccountVideoRateModel.findAndCountAll(query)
  }

  static loadLocalAndPopulateVideo (
    rateType: VideoRateType,
    accountName: string,
    videoId: number | string,
    t?: Transaction
  ): Bluebird<MAccountVideoRateAccountVideo> {
    const options: FindOptions = {
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
              attributes: [ 'id', 'url', 'followersUrl', 'preferredUsername' ],
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
    if (t) options.transaction = t

    return AccountVideoRateModel.findOne(options)
  }

  static loadByUrl (url: string, transaction: Transaction) {
    const options: FindOptions = {
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

    return AccountVideoRateModel.findAndCountAll<MAccountVideoRateAccountUrl>(query)
  }

  static cleanOldRatesOf (videoId: number, type: VideoRateType, beforeUpdatedAt: Date) {
    return AccountVideoRateModel.sequelize.transaction(async t => {
      const query = {
        where: {
          updatedAt: {
            [Op.lt]: beforeUpdatedAt
          },
          videoId,
          type,
          accountId: {
            [Op.notIn]: buildLocalAccountIdsIn()
          }
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

  toFormattedJSON (this: MAccountVideoRateFormattable): AccountVideoRate {
    return {
      video: this.Video.toFormattedJSON(),
      rating: this.type
    }
  }
}
