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
import { ActivityPubActor } from '../../../shared/models/activitypub'
import { VideoChannel, VideoChannelSummary } from '../../../shared/models/videos'
import {
  isVideoChannelDescriptionValid,
  isVideoChannelNameValid,
  isVideoChannelSupportValid
} from '../../helpers/custom-validators/video-channels'
import { sendDeleteActor } from '../../lib/activitypub/send'
import { AccountModel, ScopeNames as AccountModelScopeNames, SummaryOptions as AccountSummaryOptions } from '../account/account'
import { ActorModel, unusedActorAttributesForAPI } from '../activitypub/actor'
import { buildServerIdsFollowedBy, buildTrigramSearchIndex, createSimilarityAttribute, getSort, throwIfNotValid } from '../utils'
import { VideoModel } from './video'
import { CONSTRAINTS_FIELDS, WEBSERVER } from '../../initializers/constants'
import { ServerModel } from '../server/server'
import { FindOptions, Op, literal, ScopeOptions } from 'sequelize'
import { AvatarModel } from '../avatar/avatar'
import { VideoPlaylistModel } from './video-playlist'
import * as Bluebird from 'bluebird'
import {
  MChannelAccountDefault,
  MChannelActor,
  MChannelActorAccountDefaultVideos,
  MChannelAP,
  MChannelFormattable,
  MChannelSummaryFormattable
} from '../../types/models/video'

export enum ScopeNames {
  FOR_API = 'FOR_API',
  SUMMARY = 'SUMMARY',
  WITH_ACCOUNT = 'WITH_ACCOUNT',
  WITH_ACTOR = 'WITH_ACTOR',
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
          }
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
    const base: FindOptions = {
      attributes: [ 'id', 'name', 'description', 'actorId' ],
      include: [
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
              model: AvatarModel.unscoped(),
              required: false
            }
          ]
        }
      ]
    }

    if (options.withAccount === true) {
      base.include.push({
        model: AccountModel.scope({
          method: [ AccountModelScopeNames.SUMMARY, { withAccountBlockerIds: options.withAccountBlockerIds } as AccountSummaryOptions ]
        }),
        required: true
      })
    }

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
export class VideoChannelModel extends Model<VideoChannelModel> {

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
    },
    hooks: true
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

    const scopes = {
      method: [ ScopeNames.FOR_API, { actorId } as AvailableForListOptions ]
    }
    return VideoChannelModel
      .scope(scopes)
      .findAndCountAll(query)
      .then(({ rows, count }) => {
        return { total: count, data: rows }
      })
  }

  static listLocalsForSitemap (sort: string): Bluebird<MChannelActor[]> {
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
    const escapedSearch = VideoModel.sequelize.escape(options.search)
    const escapedLikeSearch = VideoModel.sequelize.escape('%' + options.search + '%')
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

    const scopes = {
      method: [ ScopeNames.FOR_API, { actorId: options.actorId } as AvailableForListOptions ]
    }
    return VideoChannelModel
      .scope(scopes)
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

    const scopes: string | ScopeOptions | (string | ScopeOptions)[] = [ ScopeNames.WITH_ACTOR ]

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

  static loadByIdAndPopulateAccount (id: number): Bluebird<MChannelAccountDefault> {
    return VideoChannelModel.unscoped()
      .scope([ ScopeNames.WITH_ACTOR, ScopeNames.WITH_ACCOUNT ])
      .findByPk(id)
  }

  static loadByIdAndAccount (id: number, accountId: number): Bluebird<MChannelAccountDefault> {
    const query = {
      where: {
        id,
        accountId
      }
    }

    return VideoChannelModel.unscoped()
      .scope([ ScopeNames.WITH_ACTOR, ScopeNames.WITH_ACCOUNT ])
      .findOne(query)
  }

  static loadAndPopulateAccount (id: number): Bluebird<MChannelAccountDefault> {
    return VideoChannelModel.unscoped()
      .scope([ ScopeNames.WITH_ACTOR, ScopeNames.WITH_ACCOUNT ])
      .findByPk(id)
  }

  static loadByUrlAndPopulateAccount (url: string): Bluebird<MChannelAccountDefault> {
    const query = {
      include: [
        {
          model: ActorModel,
          required: true,
          where: {
            url
          }
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

  static loadLocalByNameAndPopulateAccount (name: string): Bluebird<MChannelAccountDefault> {
    const query = {
      include: [
        {
          model: ActorModel,
          required: true,
          where: {
            preferredUsername: name,
            serverId: null
          }
        }
      ]
    }

    return VideoChannelModel.unscoped()
      .scope([ ScopeNames.WITH_ACTOR, ScopeNames.WITH_ACCOUNT ])
      .findOne(query)
  }

  static loadByNameAndHostAndPopulateAccount (name: string, host: string): Bluebird<MChannelAccountDefault> {
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
            }
          ]
        }
      ]
    }

    return VideoChannelModel.unscoped()
      .scope([ ScopeNames.WITH_ACTOR, ScopeNames.WITH_ACCOUNT ])
      .findOne(query)
  }

  static loadAndPopulateAccountAndVideos (id: number): Bluebird<MChannelActorAccountDefaultVideos> {
    const options = {
      include: [
        VideoModel
      ]
    }

    return VideoChannelModel.unscoped()
      .scope([ ScopeNames.WITH_ACTOR, ScopeNames.WITH_ACCOUNT, ScopeNames.WITH_VIDEOS ])
      .findByPk(id, options)
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
      createdAt: this.createdAt,
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

  getDisplayName () {
    return this.name
  }

  isOutdated () {
    return this.Actor.isOutdated()
  }
}
