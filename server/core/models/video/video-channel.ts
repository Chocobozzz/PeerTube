import { forceNumber, pick } from '@peertube/peertube-core-utils'
import { ActivityPubActor, VideoChannel, VideoChannelSummary, VideoPrivacy } from '@peertube/peertube-models'
import { CONFIG } from '@server/initializers/config.js'
import { InternalEventEmitter } from '@server/lib/internal-event-emitter.js'
import { MAccountHost } from '@server/types/models/index.js'
import { FindOptions, Includeable, literal, Op, QueryTypes, ScopeOptions, Transaction, WhereOptions } from 'sequelize'
import {
  AfterCreate,
  AfterDestroy,
  AfterUpdate,
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
  Is, Scopes,
  Sequelize,
  Table,
  UpdatedAt
} from 'sequelize-typescript'
import {
  isVideoChannelDescriptionValid,
  isVideoChannelDisplayNameValid,
  isVideoChannelSupportValid
} from '../../helpers/custom-validators/video-channels.js'
import { CONSTRAINTS_FIELDS, WEBSERVER } from '../../initializers/constants.js'
import { sendDeleteActor } from '../../lib/activitypub/send/index.js'
import {
  MChannelAP,
  MChannelBannerAccountDefault,
  MChannelDefault,
  MChannelFormattable,
  MChannelHost,
  MChannelSummaryFormattable,
  type MChannel
} from '../../types/models/video/index.js'
import { AccountModel, ScopeNames as AccountModelScopeNames, SummaryOptions as AccountSummaryOptions } from '../account/account.js'
import { ActorFollowModel } from '../actor/actor-follow.js'
import { ActorImageModel } from '../actor/actor-image.js'
import { ActorModel, unusedActorAttributesForAPI } from '../actor/actor.js'
import { ServerModel } from '../server/server.js'
import {
  buildServerIdsFollowedBy,
  buildTrigramSearchIndex,
  createSimilarityAttribute,
  getSort,
  SequelizeModel,
  setAsUpdated,
  throwIfNotValid
} from '../shared/index.js'
import { VideoPlaylistModel } from './video-playlist.js'
import { VideoModel } from './video.js'

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
  host?: string
  handles?: string[]
  forCount?: boolean
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

    const whereActorAnd: WhereOptions[] = [
      {
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
    ]

    let serverRequired = false
    let whereServer: WhereOptions

    if (options.host && options.host !== WEBSERVER.HOST) {
      serverRequired = true
      whereServer = { host: options.host }
    }

    if (options.host === WEBSERVER.HOST) {
      whereActorAnd.push({
        serverId: null
      })
    }

    if (Array.isArray(options.handles) && options.handles.length !== 0) {
      const or: string[] = []

      for (const handle of options.handles || []) {
        const [ preferredUsername, host ] = handle.split('@')

        const sanitizedPreferredUsername = VideoChannelModel.sequelize.escape(preferredUsername.toLowerCase())
        const sanitizedHost = VideoChannelModel.sequelize.escape(host)

        if (!host || host === WEBSERVER.HOST) {
          or.push(`(LOWER("preferredUsername") = ${sanitizedPreferredUsername} AND "serverId" IS NULL)`)
        } else {
          or.push(
            `(` +
              `LOWER("preferredUsername") = ${sanitizedPreferredUsername} ` +
              `AND "host" = ${sanitizedHost}` +
            `)`
          )
        }
      }

      whereActorAnd.push({
        id: {
          [Op.in]: literal(`(SELECT "actor".id FROM actor LEFT JOIN server on server.id = actor."serverId" WHERE ${or.join(' OR ')})`)
        }
      })
    }

    const channelActorInclude: Includeable[] = []
    const accountActorInclude: Includeable[] = []

    if (options.forCount !== true) {
      accountActorInclude.push({
        model: ServerModel,
        required: false
      })

      accountActorInclude.push({
        model: ActorImageModel,
        as: 'Avatars',
        required: false
      })

      channelActorInclude.push({
        model: ActorImageModel,
        as: 'Avatars',
        required: false
      })

      channelActorInclude.push({
        model: ActorImageModel,
        as: 'Banners',
        required: false
      })
    }

    if (options.forCount !== true || serverRequired) {
      channelActorInclude.push({
        model: ServerModel,
        duplicating: false,
        required: serverRequired,
        where: whereServer
      })
    }

    return {
      include: [
        {
          attributes: {
            exclude: unusedActorAttributesForAPI
          },
          model: ActorModel.unscoped(),
          where: {
            [Op.and]: whereActorAnd
          },
          include: channelActorInclude
        },
        {
          model: AccountModel.unscoped(),
          required: true,
          include: [
            {
              attributes: {
                exclude: unusedActorAttributesForAPI
              },
              model: ActorModel.unscoped(),
              required: true,
              include: accountActorInclude
            }
          ]
        }
      ]
    }
  },
  [ScopeNames.SUMMARY]: (options: SummaryOptions = {}) => {
    const include: Includeable[] = [
      {
        attributes: [ 'id', 'preferredUsername', 'url', 'serverId' ],
        model: ActorModel.unscoped(),
        required: options.actorRequired ?? true,
        include: [
          {
            attributes: [ 'host' ],
            model: ServerModel.unscoped(),
            required: false
          },
          {
            model: ActorImageModel,
            as: 'Avatars',
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
            as: 'Banners'
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
    const daysPrior = forceNumber(options.daysPrior)

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
          ],
          [
            literal(
              '(' +
              'SELECT COALESCE(SUM("video".views), 0) AS totalViews ' +
              'FROM "video" ' +
              'WHERE "video"."channelId" = "VideoChannelModel"."id"' +
              ')'
            ),
            'totalViews'
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
export class VideoChannelModel extends SequelizeModel<VideoChannelModel> {

  @AllowNull(false)
  @Is('VideoChannelName', value => throwIfNotValid(value, isVideoChannelDisplayNameValid, 'name'))
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
  Actor: Awaited<ActorModel>

  @ForeignKey(() => AccountModel)
  @Column
  accountId: number

  @BelongsTo(() => AccountModel, {
    foreignKey: {
      allowNull: false
    }
  })
  Account: Awaited<AccountModel>

  @HasMany(() => VideoModel, {
    foreignKey: {
      name: 'channelId',
      allowNull: false
    },
    onDelete: 'CASCADE',
    hooks: true
  })
  Videos: Awaited<VideoModel>[]

  @HasMany(() => VideoPlaylistModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'CASCADE',
    hooks: true
  })
  VideoPlaylists: Awaited<VideoPlaylistModel>[]

  @AfterCreate
  static notifyCreate (channel: MChannel) {
    InternalEventEmitter.Instance.emit('channel-created', { channel })
  }

  @AfterUpdate
  static notifyUpdate (channel: MChannel) {
    InternalEventEmitter.Instance.emit('channel-updated', { channel })
  }

  @AfterDestroy
  static notifyDestroy (channel: MChannel) {
    InternalEventEmitter.Instance.emit('channel-deleted', { channel })
  }

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

  @AfterDestroy
  static async deleteActorIfRemote (instance: VideoChannelModel, options) {
    if (!instance.Actor) {
      instance.Actor = await instance.$get('Actor', { transaction: options.transaction })
    }

    // Remote actor, delete it
    if (instance.Actor.serverId) {
      await instance.Actor.destroy({ transaction: options.transaction })
    }
  }

  static countByAccount (accountId: number) {
    const query = {
      where: {
        accountId
      }
    }

    return VideoChannelModel.unscoped().count(query)
  }

  static async getStats () {

    function getLocalVideoChannelStats (days?: number) {
      const options = {
        type: QueryTypes.SELECT as QueryTypes.SELECT,
        raw: true
      }

      const videoJoin = days
        ? `INNER JOIN "video" AS "Videos" ON "VideoChannelModel"."id" = "Videos"."channelId" ` +
             `AND ("Videos"."publishedAt" > Now() - interval '${days}d')`
        : ''

      const query = `
      SELECT COUNT(DISTINCT("VideoChannelModel"."id")) AS "count"
      FROM "videoChannel" AS "VideoChannelModel"
      ${videoJoin}
      INNER JOIN "account" AS "Account" ON "VideoChannelModel"."accountId" = "Account"."id"
      INNER JOIN "actor" AS "Account->Actor" ON "Account"."actorId" = "Account->Actor"."id"
        AND "Account->Actor"."serverId" IS NULL`

      return VideoChannelModel.sequelize.query<{ count: string }>(query, options)
                              .then(r => parseInt(r[0].count, 10))
    }

    const totalLocalVideoChannels = await getLocalVideoChannelStats()
    const totalLocalDailyActiveVideoChannels = await getLocalVideoChannelStats(1)
    const totalLocalWeeklyActiveVideoChannels = await getLocalVideoChannelStats(7)
    const totalLocalMonthlyActiveVideoChannels = await getLocalVideoChannelStats(30)
    const totalLocalHalfYearActiveVideoChannels = await getLocalVideoChannelStats(180)

    return {
      totalLocalVideoChannels,
      totalLocalDailyActiveVideoChannels,
      totalLocalWeeklyActiveVideoChannels,
      totalLocalMonthlyActiveVideoChannels,
      totalLocalHalfYearActiveVideoChannels
    }
  }

  static listLocalsForSitemap (sort: string): Promise<MChannelHost[]> {
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
      ],
      where: {
        [Op.and]: [
          literal(`EXISTS (SELECT 1 FROM "video" WHERE "privacy" = ${VideoPrivacy.PUBLIC} AND "channelId" = "VideoChannelModel"."id")`)
        ]
      }
    }

    return VideoChannelModel
      .unscoped()
      .findAll(query)
  }

  static listForApi (parameters: Pick<AvailableForListOptions, 'actorId'> & {
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

    const getScope = (forCount: boolean) => {
      return { method: [ ScopeNames.FOR_API, { actorId, forCount } as AvailableForListOptions ] }
    }

    return Promise.all([
      VideoChannelModel.scope(getScope(true)).count(),
      VideoChannelModel.scope(getScope(false)).findAll(query)
    ]).then(([ total, data ]) => ({ total, data }))
  }

  static searchForApi (options: Pick<AvailableForListOptions, 'actorId' | 'search' | 'host' | 'handles'> & {
    start: number
    count: number
    sort: string
  }) {
    let attributesInclude: any[] = [ literal('0 as similarity') ]
    let where: WhereOptions

    if (options.search) {
      const escapedSearch = VideoChannelModel.sequelize.escape(options.search)
      const escapedLikeSearch = VideoChannelModel.sequelize.escape('%' + options.search + '%')
      attributesInclude = [ createSimilarityAttribute('VideoChannelModel.name', options.search) ]

      where = {
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

    const query = {
      attributes: {
        include: attributesInclude
      },
      offset: options.start,
      limit: options.count,
      order: getSort(options.sort),
      where
    }

    const getScope = (forCount: boolean) => {
      return {
        method: [
          ScopeNames.FOR_API, {
            ...pick(options, [ 'actorId', 'host', 'handles' ]),

            forCount
          } as AvailableForListOptions
        ]
      }
    }

    return Promise.all([
      VideoChannelModel.scope(getScope(true)).count(query),
      VideoChannelModel.scope(getScope(false)).findAll(query)
    ]).then(([ total, data ]) => ({ total, data }))
  }

  static listByAccountForAPI (options: {
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

    const getQuery = (forCount: boolean) => {
      const accountModel = forCount
        ? AccountModel.unscoped()
        : AccountModel

      return {
        offset: options.start,
        limit: options.count,
        order: getSort(options.sort),
        include: [
          {
            model: accountModel,
            where: {
              id: options.accountId
            },
            required: true
          }
        ],
        where
      }
    }

    const findScopes: string | ScopeOptions | (string | ScopeOptions)[] = [ ScopeNames.WITH_ACTOR_BANNER ]

    if (options.withStats === true) {
      findScopes.push({
        method: [ ScopeNames.WITH_STATS, { daysPrior: 30 } as AvailableWithStatsOptions ]
      })
    }

    return Promise.all([
      VideoChannelModel.unscoped().count(getQuery(true)),
      VideoChannelModel.scope(findScopes).findAll(getQuery(false))
    ]).then(([ total, data ]) => ({ total, data }))
  }

  static listAllByAccount (accountId: number): Promise<MChannelDefault[]> {
    const query = {
      limit: CONFIG.VIDEO_CHANNELS.MAX_PER_USER,
      include: [
        {
          attributes: [],
          model: AccountModel.unscoped(),
          where: {
            id: accountId
          },
          required: true
        }
      ]
    }

    return VideoChannelModel.findAll(query)
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
              as: 'Banners'
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
            [Op.and]: [
              ActorModel.wherePreferredUsername(name, 'Actor.preferredUsername'),
              { serverId: null }
            ]
          },
          include: [
            {
              model: ActorImageModel,
              required: false,
              as: 'Banners'
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
          where: ActorModel.wherePreferredUsername(name, 'Actor.preferredUsername'),
          include: [
            {
              model: ServerModel,
              required: true,
              where: { host }
            },
            {
              model: ActorImageModel,
              required: false,
              as: 'Banners'
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
      avatars: actor.avatars
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

    const totalViews = this.get('totalViews') as number

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
      viewsPerDay,
      totalViews,

      avatars: actor.avatars
    }

    if (this.Account) videoChannel.ownerAccount = this.Account.toFormattedJSON()

    return Object.assign(actor, videoChannel)
  }

  async toActivityPubObject (this: MChannelAP): Promise<ActivityPubActor> {
    const obj = await this.Actor.toActivityPubObject(this.name)

    return {
      ...obj,

      summary: this.description,
      support: this.support,
      postingRestrictedToMods: true,
      attributedTo: [
        {
          type: 'Person' as 'Person',
          id: this.Account.Actor.url
        }
      ]
    }
  }

  // Avoid error when running this method on MAccount... | MChannel...
  getClientUrl (this: MAccountHost | MChannelHost) {
    return WEBSERVER.URL + '/c/' + this.Actor.getIdentifier() + '/videos'
  }

  getDisplayName () {
    return this.name
  }

  isOutdated () {
    return this.Actor.isOutdated()
  }

  setAsUpdated (transaction?: Transaction) {
    return setAsUpdated({ sequelize: this.sequelize, table: 'videoChannel', id: this.id, transaction })
  }
}
