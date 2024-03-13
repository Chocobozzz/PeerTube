import { AccountVideoRate, type VideoRateType } from '@peertube/peertube-models'
import {
  MAccountVideoRate,
  MAccountVideoRateAccountUrl,
  MAccountVideoRateAccountVideo,
  MAccountVideoRateFormattable,
  MAccountVideoRateVideoUrl
} from '@server/types/models/index.js'
import { FindOptions, Op, QueryTypes, Transaction } from 'sequelize'
import { AllowNull, BelongsTo, Column, CreatedAt, DataType, ForeignKey, Is, Table, UpdatedAt } from 'sequelize-typescript'
import { isActivityPubUrlValid } from '../../helpers/custom-validators/activitypub/misc.js'
import { CONSTRAINTS_FIELDS, USER_EXPORT_MAX_ITEMS, VIDEO_RATE_TYPES } from '../../initializers/constants.js'
import { ActorModel } from '../actor/actor.js'
import { SequelizeModel, getSort, throwIfNotValid } from '../shared/index.js'
import { SummaryOptions, VideoChannelModel, ScopeNames as VideoChannelScopeNames } from '../video/video-channel.js'
import { VideoModel } from '../video/video.js'
import { AccountModel } from './account.js'

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
export class AccountVideoRateModel extends SequelizeModel<AccountVideoRateModel> {

  @AllowNull(false)
  @Column(DataType.ENUM(...Object.values(VIDEO_RATE_TYPES)))
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
  Video: Awaited<VideoModel>

  @ForeignKey(() => AccountModel)
  @Column
  accountId: number

  @BelongsTo(() => AccountModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'CASCADE'
  })
  Account: Awaited<AccountModel>

  static load (accountId: number, videoId: number, transaction?: Transaction): Promise<MAccountVideoRate> {
    const options: FindOptions = {
      where: {
        accountId,
        videoId
      }
    }
    if (transaction) options.transaction = transaction

    return AccountVideoRateModel.findOne(options)
  }

  static loadByAccountAndVideoOrUrl (accountId: number, videoId: number, url: string, t?: Transaction): Promise<MAccountVideoRate> {
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

  static loadLocalAndPopulateVideo (
    rateType: VideoRateType,
    accountName: string,
    videoId: number,
    t?: Transaction
  ): Promise<MAccountVideoRateAccountVideo> {
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
                [Op.and]: [
                  ActorModel.wherePreferredUsername(accountName),
                  { serverId: null }
                ]
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

  // ---------------------------------------------------------------------------

  static listByAccountForApi (options: {
    start: number
    count: number
    sort: string
    type?: string
    accountId: number
  }) {
    const getQuery = (forCount: boolean) => {
      const query: FindOptions = {
        offset: options.start,
        limit: options.count,
        order: getSort(options.sort),
        where: {
          accountId: options.accountId
        }
      }

      if (options.type) query.where['type'] = options.type

      if (forCount !== true) {
        query.include = [
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

      return query
    }

    return Promise.all([
      AccountVideoRateModel.count(getQuery(true)),
      AccountVideoRateModel.findAll(getQuery(false))
    ]).then(([ total, data ]) => ({ total, data }))
  }

  static listRemoteRateUrlsOfLocalVideos () {
    const query = `SELECT "accountVideoRate".url FROM "accountVideoRate" ` +
      `INNER JOIN account ON account.id = "accountVideoRate"."accountId" ` +
      `INNER JOIN actor ON actor.id = account."actorId" AND actor."serverId" IS NOT NULL ` +
      `INNER JOIN video ON video.id = "accountVideoRate"."videoId" AND video.remote IS FALSE`

    return AccountVideoRateModel.sequelize.query<{ url: string }>(query, {
      type: QueryTypes.SELECT,
      raw: true
    }).then(rows => rows.map(r => r.url))
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

    return Promise.all([
      AccountVideoRateModel.count(query),
      AccountVideoRateModel.findAll<MAccountVideoRateAccountUrl>(query)
    ]).then(([ total, data ]) => ({ total, data }))
  }

  static listRatesOfAccountIdForExport (accountId: number, rateType: VideoRateType): Promise<MAccountVideoRateVideoUrl[]> {
    return AccountVideoRateModel.findAll({
      where: {
        accountId,
        type: rateType
      },
      include: [
        {
          attributes: [ 'url' ],
          model: VideoModel,
          required: true
        }
      ],
      limit: USER_EXPORT_MAX_ITEMS
    })
  }

  // ---------------------------------------------------------------------------

  toFormattedJSON (this: MAccountVideoRateFormattable): AccountVideoRate {
    return {
      video: this.Video.toFormattedJSON(),
      rating: this.type
    }
  }
}
