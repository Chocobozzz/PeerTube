import { FindOptions, Includeable, literal, Op, QueryTypes, ScopeOptions, Transaction } from 'sequelize'
import {
  AllowNull,
  BeforeDestroy,
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  Default,
  DefaultScope,
  ForeignKey,
  HasMany,
  Is,
  Model,
  Scopes,
  Sequelize,
  Table,
  UpdatedAt
} from 'sequelize-typescript'
import { setAsUpdated } from '@server/helpers/database-utils'
import { MAccountActor } from '@server/types/models'
import { AttributesOnly } from '@shared/core-utils'
import { ActivityPubActor } from '../../../shared/models/activitypub'
import { VideoChannel, VideoChannelSummary } from '../../../shared/models/videos'
import {
  isVideoChannelDescriptionValid,
  isVideoChannelNameValid,
  isVideoChannelSupportValid
} from '../../helpers/custom-validators/video-channels'
import { CONSTRAINTS_FIELDS, WEBSERVER } from '../../initializers/constants'
import { sendDeleteActor } from '../../lib/activitypub/send'
import {
  MChannelActor,
  MChannelAP,
  MChannelBannerAccountDefault,
  MChannelFormattable,
  MChannelSummaryFormattable
} from '../../types/models/video'
import { AccountModel, ScopeNames as AccountModelScopeNames, SummaryOptions as AccountSummaryOptions } from '../account/account'
import { ActorModel, unusedActorAttributesForAPI } from '../actor/actor'
import { ActorFollowModel } from '../actor/actor-follow'
import { ActorImageModel } from '../actor/actor-image'
import { ServerModel } from '../server/server'
import { buildServerIdsFollowedBy, buildTrigramSearchIndex, createSimilarityAttribute, getSort, throwIfNotValid } from '../utils'
import { VideoModel } from './video'
import { VideoPlaylistModel } from './video-playlist'

export enum ScopeNames {
  FOR_API = 'FOR_API',
  SUMMARY = 'SUMMARY',
  WITH_ACCOUNT = 'WITH_ACCOUNT',
  WITH_ACTOR = 'WITH_ACTOR',
  WITH_ACTOR_BANNER = 'WITH_ACTOR_BANNER',
  WITH_VIDEOS = 'WITH_VIDEOS',
  WITH_STATS = 'WITH_STATS'
}

type AvailableForListOptions = {
  actorId: number
  search?: string
}

type AvailableWithStatsOptions = {
  daysPrior: number
}

export type SummaryOptions = {
  actorRequired?: boolean // Default: true
  withAccount?: boolean // Default: false
  withAccountBlockerIds?: number[]
}

@DefaultScope(() => ({
  include: [
    {
      model: ActorModel,
      required: true
    }
  ]
}))
@Scopes(() => ({
  [ScopeNames.FOR_API]: (options: AvailableForListOptions) => {
    // Only list local channels OR channels that are on an instance followed by actorId
    const inQueryInstanceFollow = buildServerIdsFollowedBy(options.actorId)

    return {
      include: [
        {
          attributes: {
            exclude: unusedActorAttributesForAPI
          },
          model: ActorModel,
          where: {
            [Op.or]: [
              {
                serverId: null
              },
              {
                serverId: {
                  [Op.in]: Sequelize.literal(inQueryInstanceFollow)
                }
              }
            ]
          },
          include: [
            {
              model: ActorImageModel,
              as: 'Banner',
              required: false
            }
          ]
        },
        {
          model: AccountModel,
          required: true,
          include: [
            {
              attributes: {
                exclude: unusedActorAttributesForAPI
              },
              model: ActorModel, // Default scope includes avatar and server
              required: true
            }
          ]
        }
      ]
    }
  },
  [ScopeNames.SUMMARY]: (options: SummaryOptions = {}) => {
    const include: Includeable[] = [
      {
        attributes: [ 'id', 'preferredUsername', 'url', 'serverId', 'avatarId' ],
        model: ActorModel.unscoped(),
        required: options.actorRequired ?? true,
        include: [
          {
            attributes: [ 'host' ],
            model: ServerModel.unscoped(),
            required: false
          },
          {
            model: ActorImageModel.unscoped(),
            as: 'Avatar',
            required: false
          }
        ]
      }
    ]

    const base: FindOptions = {
      attributes: [ 'id', 'name', 'description', 'actorId' ]
    }

    if (options.withAccount === true) {
      include.push({
        model: AccountModel.scope({
          method: [ AccountModelScopeNames.SUMMARY, { withAccountBlockerIds: options.withAccountBlockerIds } as AccountSummaryOptions ]
        }),
        required: true
      })
    }

    base.include = include

    return base
  },
  [ScopeNames.WITH_ACCOUNT]: {
    include: [
      {
        model: AccountModel,
        required: true
      }
    ]
  },
  [ScopeNames.WITH_ACTOR]: {
    include: [
      ActorModel
    ]
  },
  [ScopeNames.WITH_ACTOR_BANNER]: {
    include: [
      {
        model: ActorModel,
        include: [
          {
            model: ActorImageModel,
            required: false,
            as: 'Banner'
          }
        ]
      }
    ]
  },
  [ScopeNames.WITH_VIDEOS]: {
    include: [
      VideoModel
    ]
  },
  [ScopeNames.WITH_STATS]: (options: AvailableWithStatsOptions = { daysPrior: 30 }) => {
    const daysPrior = parseInt(options.daysPrior + '', 10)

    return {
      attributes: {
        include: [
          [
            literal('(SELECT COUNT(*) FROM "video" WHERE "channelId" = "VideoChannelModel"."id")'),
            'videosCount'
          ],
          [
            literal(
              '(' +
              `SELECT string_agg(concat_ws('|', t.day, t.views), ',') ` +
              'FROM ( ' +
                'WITH ' +
                  'days AS ( ' +
                    `SELECT generate_series(date_trunc('day', now()) - '${daysPrior} day'::interval, ` +
                          `date_trunc('day', now()), '1 day'::interval) AS day ` +
                  ') ' +
                  'SELECT days.day AS day, COALESCE(SUM("videoView".views), 0) AS views ' +
                  'FROM days ' +
                  'LEFT JOIN (' +
                    '"videoView" INNER JOIN "video" ON "videoView"."videoId" = "video"."id" ' +
                    'AND "video"."channelId" = "VideoChannelModel"."id"' +
                  `) ON date_trunc('day', "videoView"."startDate") = date_trunc('day', days.day) ` +
                  'GROUP BY day ' +
                  'ORDER BY day ' +
                ') t' +
              ')'
            ),
            'viewsPerDay'
          ]
        ]
      }
    }
  }
}))
@Table({
  tableName: 'videoChannel',
  indexes: [
    buildTrigramSearchIndex('video_channel_name_trigram', 'name'),

    {
      fields: [ 'accountId' ]
    },
    {
      fields: [ 'actorId' ]
    }
  ]
})
export class VideoChannelModel extends Model<Partial<AttributesOnly<VideoChannelModel>>> {

  @AllowNull(false)
  @Is('VideoChannelName', value => throwIfNotValid(value, isVideoChannelNameValid, 'name'))
  @Column
  name: string

  @AllowNull(true)
  @Default(null)
  @Is('VideoChannelDescription', value => throwIfNotValid(value, isVideoChannelDescriptionValid, 'description', true))
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.VIDEO_CHANNELS.DESCRIPTION.max))
  description: string

  @AllowNull(true)
  @Default(null)
  @Is('VideoChannelSupport', value => throwIfNotValid(value, isVideoChannelSupportValid, 'support', true))
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.VIDEO_CHANNELS.SUPPORT.max))
  support: string

  @CreatedAt
  createdAt: Date

  @UpdatedAt
  updatedAt: Date

  @ForeignKey(() => ActorModel)
  @Column
  actorId: number

  @BelongsTo(() => ActorModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'cascade'
  })
  Actor: ActorModel

  @ForeignKey(() => AccountModel)
  @Column
  accountId: number

  @BelongsTo(() => AccountModel, {
    foreignKey: {
      allowNull: false
    }
  })
  Account: AccountModel

  @HasMany(() => VideoModel, {
    foreignKey: {
      name: 'channelId',
      allowNull: false
    },
    onDelete: 'CASCADE',
    hooks: true
  })
  Videos: VideoModel[]

  @HasMany(() => VideoPlaylistModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'CASCADE',
    hooks: true
  })
  VideoPlaylists: VideoPlaylistModel[]

  @BeforeDestroy
  static async sendDeleteIfOwned (instance: VideoChannelModel, options) {
    if (!instance.Actor) {
      instance.Actor = await instance.$get('Actor', { transaction: options.transaction })
    }

    await ActorFollowModel.removeFollowsOf(instance.Actor.id, options.transaction)

    if (instance.Actor.isOwned()) {
      return sendDeleteActor(instance.Actor, options.transaction)
    }

    return undefined
  }

  static countByAccount (accountId: number) {
    const query = {
      where: {
        accountId
      }
    }

    return VideoChannelModel.count(query)
  }

  static async getStats () {

    function getActiveVideoChannels (days: number) {
      const options = {
        type: QueryTypes.SELECT as QueryTypes.SELECT,
        raw: true
      }

      const query = `
SELECT          COUNT(DISTINCT("VideoChannelModel"."id")) AS "count"
FROM            "videoChannel"                            AS "VideoChannelModel"
INNER JOIN      "video"                                   AS "Videos"
ON              "VideoChannelModel"."id" = "Videos"."channelId"
AND             ("Videos"."publishedAt" > Now() - interval '${days}d')
INNER JOIN      "account" AS "Account"
ON              "VideoChannelModel"."accountId" = "Account"."id"
INNER JOIN      "actor" AS "Account->Actor"
ON              "Account"."actorId" = "Account->Actor"."id"
AND             "Account->Actor"."serverId" IS NULL
LEFT OUTER JOIN "server" AS "Account->Actor->Server"
ON              "Account->Actor"."serverId" = "Account->Actor->Server"."id"`

      return VideoChannelModel.sequelize.query<{ count: string }>(query, options)
                              .then(r => parseInt(r[0].count, 10))
    }

    const totalLocalVideoChannels = await VideoChannelModel.count()
    const totalLocalDailyActiveVideoChannels = await getActiveVideoChannels(1)
    const totalLocalWeeklyActiveVideoChannels = await getActiveVideoChannels(7)
    const totalLocalMonthlyActiveVideoChannels = await getActiveVideoChannels(30)
    const totalHalfYearActiveVideoChannels = await getActiveVideoChannels(180)

    return {
      totalLocalVideoChannels,
      totalLocalDailyActiveVideoChannels,
      totalLocalWeeklyActiveVideoChannels,
      totalLocalMonthlyActiveVideoChannels,
      totalHalfYearActiveVideoChannels
    }
  }

  static listForApi (parameters: {
    actorId: number
    start: number
    count: number
    sort: string
  }) {
    const { actorId } = parameters

    const query = {
      offset: parameters.start,
      limit: parameters.count,
      order: getSort(parameters.sort)
    }

    return VideoChannelModel
      .scope({
        method: [ ScopeNames.FOR_API, { actorId } as AvailableForListOptions ]
      })
      .findAndCountAll(query)
      .then(({ rows, count }) => {
        return { total: count, data: rows }
      })
  }

  static listLocalsForSitemap (sort: string): Promise<MChannelActor[]> {
    const query = {
      attributes: [ ],
      offset: 0,
      order: getSort(sort),
      include: [
        {
          attributes: [ 'preferredUsername', 'serverId' ],
          model: ActorModel.unscoped(),
          where: {
            serverId: null
          }
        }
      ]
    }

    return VideoChannelModel
      .unscoped()
      .findAll(query)
  }

  static searchForApi (options: {
    actorId: number
    search: string
    start: number
    count: number
    sort: string
  }) {
    const attributesInclude = []
    const escapedSearch = VideoChannelModel.sequelize.escape(options.search)
    const escapedLikeSearch = VideoChannelModel.sequelize.escape('%' + options.search + '%')
    attributesInclude.push(createSimilarityAttribute('VideoChannelModel.name', options.search))

    const query = {
      attributes: {
        include: attributesInclude
      },
      offset: options.start,
      limit: options.count,
      order: getSort(options.sort),
      where: {
        [Op.or]: [
          Sequelize.literal(
            'lower(immutable_unaccent("VideoChannelModel"."name")) % lower(immutable_unaccent(' + escapedSearch + '))'
          ),
          Sequelize.literal(
            'lower(immutable_unaccent("VideoChannelModel"."name")) LIKE lower(immutable_unaccent(' + escapedLikeSearch + '))'
          )
        ]
      }
    }

    return VideoChannelModel
      .scope({
        method: [ ScopeNames.FOR_API, { actorId: options.actorId } as AvailableForListOptions ]
      })
      .findAndCountAll(query)
      .then(({ rows, count }) => {
        return { total: count, data: rows }
      })
  }

  static listByAccount (options: {
    accountId: number
    start: number
    count: number
    sort: string
    withStats?: boolean
    search?: string
  }) {
    const escapedSearch = VideoModel.sequelize.escape(options.search)
    const escapedLikeSearch = VideoModel.sequelize.escape('%' + options.search + '%')
    const where = options.search
      ? {
        [Op.or]: [
          Sequelize.literal(
            'lower(immutable_unaccent("VideoChannelModel"."name")) % lower(immutable_unaccent(' + escapedSearch + '))'
          ),
          Sequelize.literal(
            'lower(immutable_unaccent("VideoChannelModel"."name")) LIKE lower(immutable_unaccent(' + escapedLikeSearch + '))'
          )
        ]
      }
      : null

    const query = {
      offset: options.start,
      limit: options.count,
      order: getSort(options.sort),
      include: [
        {
          model: AccountModel,
          where: {
            id: options.accountId
          },
          required: true
        }
      ],
      where
    }

    const scopes: string | ScopeOptions | (string | ScopeOptions)[] = [ ScopeNames.WITH_ACTOR_BANNER ]

    if (options.withStats === true) {
      scopes.push({
        method: [ ScopeNames.WITH_STATS, { daysPrior: 30 } as AvailableWithStatsOptions ]
      })
    }

    return VideoChannelModel
      .scope(scopes)
      .findAndCountAll(query)
      .then(({ rows, count }) => {
        return { total: count, data: rows }
      })
  }

  static loadAndPopulateAccount (id: number, transaction?: Transaction): Promise<MChannelBannerAccountDefault> {
    return VideoChannelModel.unscoped()
      .scope([ ScopeNames.WITH_ACTOR_BANNER, ScopeNames.WITH_ACCOUNT ])
      .findByPk(id, { transaction })
  }

  static loadByUrlAndPopulateAccount (url: string): Promise<MChannelBannerAccountDefault> {
    const query = {
      include: [
        {
          model: ActorModel,
          required: true,
          where: {
            url
          },
          include: [
            {
              model: ActorImageModel,
              required: false,
              as: 'Banner'
            }
          ]
        }
      ]
    }

    return VideoChannelModel
      .scope([ ScopeNames.WITH_ACCOUNT ])
      .findOne(query)
  }

  static loadByNameWithHostAndPopulateAccount (nameWithHost: string) {
    const [ name, host ] = nameWithHost.split('@')

    if (!host || host === WEBSERVER.HOST) return VideoChannelModel.loadLocalByNameAndPopulateAccount(name)

    return VideoChannelModel.loadByNameAndHostAndPopulateAccount(name, host)
  }

  static loadLocalByNameAndPopulateAccount (name: string): Promise<MChannelBannerAccountDefault> {
    const query = {
      include: [
        {
          model: ActorModel,
          required: true,
          where: {
            preferredUsername: name,
            serverId: null
          },
          include: [
            {
              model: ActorImageModel,
              required: false,
              as: 'Banner'
            }
          ]
        }
      ]
    }

    return VideoChannelModel.unscoped()
      .scope([ ScopeNames.WITH_ACCOUNT ])
      .findOne(query)
  }

  static loadByNameAndHostAndPopulateAccount (name: string, host: string): Promise<MChannelBannerAccountDefault> {
    const query = {
      include: [
        {
          model: ActorModel,
          required: true,
          where: {
            preferredUsername: name
          },
          include: [
            {
              model: ServerModel,
              required: true,
              where: { host }
            },
            {
              model: ActorImageModel,
              required: false,
              as: 'Banner'
            }
          ]
        }
      ]
    }

    return VideoChannelModel.unscoped()
      .scope([ ScopeNames.WITH_ACCOUNT ])
      .findOne(query)
  }

  toFormattedSummaryJSON (this: MChannelSummaryFormattable): VideoChannelSummary {
    const actor = this.Actor.toFormattedSummaryJSON()

    return {
      id: this.id,
      name: actor.name,
      displayName: this.getDisplayName(),
      url: actor.url,
      host: actor.host,
      avatar: actor.avatar
    }
  }

  toFormattedJSON (this: MChannelFormattable): VideoChannel {
    const viewsPerDayString = this.get('viewsPerDay') as string
    const videosCount = this.get('videosCount') as number

    let viewsPerDay: { date: Date, views: number }[]

    if (viewsPerDayString) {
      viewsPerDay = viewsPerDayString.split(',')
        .map(v => {
          const [ dateString, amount ] = v.split('|')

          return {
            date: new Date(dateString),
            views: +amount
          }
        })
    }

    const actor = this.Actor.toFormattedJSON()
    const videoChannel = {
      id: this.id,
      displayName: this.getDisplayName(),
      description: this.description,
      support: this.support,
      isLocal: this.Actor.isOwned(),
      updatedAt: this.updatedAt,
      ownerAccount: undefined,
      videosCount,
      viewsPerDay
    }

    if (this.Account) videoChannel.ownerAccount = this.Account.toFormattedJSON()

    return Object.assign(actor, videoChannel)
  }

  toActivityPubObject (this: MChannelAP): ActivityPubActor {
    const obj = this.Actor.toActivityPubObject(this.name)

    return Object.assign(obj, {
      summary: this.description,
      support: this.support,
      attributedTo: [
        {
          type: 'Person' as 'Person',
          id: this.Account.Actor.url
        }
      ]
    })
  }

  getLocalUrl (this: MAccountActor | MChannelActor) {
    return WEBSERVER.URL + `/video-channels/` + this.Actor.preferredUsername
  }

  getDisplayName () {
    return this.name
  }

  isOutdated () {
    return this.Actor.isOutdated()
  }

  setAsUpdated (transaction: Transaction) {
    return setAsUpdated('videoChannel', this.id, transaction)
  }
}
