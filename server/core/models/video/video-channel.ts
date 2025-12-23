import { ActivityPubActor, ActivityUrlObject, VideoChannel, VideoChannelSummary, VideoPrivacy } from '@peertube/peertube-models'
import { AttributesOnly } from '@peertube/peertube-typescript-utils'
import { CONFIG } from '@server/initializers/config.js'
import { getLocalActorPlayerSettingsActivityPubUrl } from '@server/lib/activitypub/url.js'
import { InternalEventEmitter } from '@server/lib/internal-event-emitter.js'
import { MAccountIdHost } from '@server/types/models/index.js'
import { FindOptions, Includeable, literal, Op, QueryTypes, Transaction } from 'sequelize'
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
  HasOne,
  Is,
  Scopes,
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
  MChannelIdHost,
  MChannelSummaryFormattable,
  type MChannel
} from '../../types/models/video/index.js'
import { AccountModel, ScopeNames as AccountModelScopeNames, SummaryOptions as AccountSummaryOptions } from '../account/account.js'
import { ActorImageModel } from '../actor/actor-image.js'
import { ActorModel, actorSummaryAttributes } from '../actor/actor.js'
import { ServerModel, serverSummaryAttributes } from '../server/server.js'
import { buildSQLAttributes, buildTrigramSearchIndex, getSort, SequelizeModel, setAsUpdated, throwIfNotValid } from '../shared/index.js'
import { ListVideoChannelsOptions, VideoChannelListQueryBuilder } from './sql/channel/video-channel-list-query-builder.js'
import { VideoChannelCollaboratorModel } from './video-channel-collaborator.js'
import { VideoPlaylistModel } from './video-playlist.js'
import { VideoModel } from './video.js'

const channelSummaryAttributes = [ 'id', 'name', 'description' ] as const satisfies (keyof AttributesOnly<AccountModel>)[]

export enum ScopeNames {
  SUMMARY = 'SUMMARY',
  WITH_ACCOUNT = 'WITH_ACCOUNT',
  WITH_ACTOR = 'WITH_ACTOR',
  WITH_ACTOR_BANNER = 'WITH_ACTOR_BANNER',
  WITH_VIDEOS = 'WITH_VIDEOS'
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
  [ScopeNames.SUMMARY]: (options: SummaryOptions = {}) => {
    const include: Includeable[] = [
      {
        attributes: actorSummaryAttributes,
        model: ActorModel.unscoped(),
        required: options.actorRequired ?? true,
        include: [
          {
            attributes: serverSummaryAttributes,
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
      attributes: channelSummaryAttributes
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
  }
}))
@Table({
  tableName: 'videoChannel',
  indexes: [
    buildTrigramSearchIndex('video_channel_name_trigram', 'name'),

    {
      fields: [ 'accountId' ]
    }
  ]
})
export class VideoChannelModel extends SequelizeModel<VideoChannelModel> {
  @AllowNull(false)
  @Is('VideoChannelName', value => throwIfNotValid(value, isVideoChannelDisplayNameValid, 'name'))
  @Column
  declare name: string

  @AllowNull(true)
  @Default(null)
  @Is('VideoChannelDescription', value => throwIfNotValid(value, isVideoChannelDescriptionValid, 'description', true))
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.VIDEO_CHANNELS.DESCRIPTION.max))
  declare description: string

  @AllowNull(true)
  @Default(null)
  @Is('VideoChannelSupport', value => throwIfNotValid(value, isVideoChannelSupportValid, 'support', true))
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.VIDEO_CHANNELS.SUPPORT.max))
  declare support: string

  @CreatedAt
  declare createdAt: Date

  @UpdatedAt
  declare updatedAt: Date

  @ForeignKey(() => AccountModel)
  @Column
  declare accountId: number

  @BelongsTo(() => AccountModel, {
    foreignKey: {
      allowNull: false
    }
  })
  declare Account: Awaited<AccountModel>

  @HasMany(() => VideoModel, {
    foreignKey: {
      name: 'channelId',
      allowNull: false
    },
    onDelete: 'CASCADE',
    hooks: true
  })
  declare Videos: Awaited<VideoModel>[]

  @HasMany(() => VideoPlaylistModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'CASCADE',
    hooks: true
  })
  declare VideoPlaylists: Awaited<VideoPlaylistModel>[]

  @HasMany(() => VideoChannelCollaboratorModel, {
    foreignKey: 'accountId',
    onDelete: 'CASCADE'
  })
  declare VideoChannelCollaborators: Awaited<VideoChannelCollaboratorModel>[]

  @HasOne(() => ActorModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'cascade',
    hooks: true
  })
  declare Actor: Awaited<ActorModel>

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

    if (instance.Actor.isLocal()) {
      return sendDeleteActor(instance.Actor, options.transaction)
    }

    return undefined
  }

  // ---------------------------------------------------------------------------

  static getSQLAttributes (tableName: string, aliasPrefix = '') {
    return buildSQLAttributes({
      model: this,
      tableName,
      aliasPrefix
    })
  }

  static getSQLSummaryAttributes (tableName: string, aliasPrefix = '') {
    return buildSQLAttributes({
      model: this,
      tableName,
      aliasPrefix,
      includeAttributes: channelSummaryAttributes
    })
  }

  // ---------------------------------------------------------------------------

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
      INNER JOIN "actor" AS "Account->Actor" ON "Account"."id" = "Account->Actor"."accountId"
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
      attributes: [],
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

  // ---------------------------------------------------------------------------

  static listForApi (options: ListVideoChannelsOptions) {
    return Promise.all([
      new VideoChannelListQueryBuilder(VideoChannelModel.sequelize, options).list<VideoChannelModel>() as Promise<MChannelFormattable[]>,
      new VideoChannelListQueryBuilder(VideoChannelModel.sequelize, options).count()
    ]).then(([ rows, count ]) => {
      return { total: count, data: rows }
    })
  }

  static listByAccountForAPI (
    options: Pick<ListVideoChannelsOptions, 'accountId' | 'includeCollaborations' | 'search' | 'start' | 'count' | 'sort'> & {
      withStats?: boolean
    }
  ) {
    const listOptions = options.withStats
      ? { ...options, statsDaysPrior: 30 }
      : options

    return this.listForApi(listOptions)
  }

  // ---------------------------------------------------------------------------

  static listAllOwnedByAccount (accountId: number): Promise<MChannelDefault[]> {
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

  static loadByHandleAndPopulateAccount (handle: string) {
    const [ name, host ] = handle.split('@')

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
      isLocal: this.Actor.isLocal(),
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

      url: [
        {
          type: 'Link',
          mediaType: 'text/html',
          href: this.getClientUrl(true)
        },
        {
          type: 'Link',
          mediaType: 'text/html',
          href: this.getClientUrl(false)
        },
        {
          type: 'Link',
          mediaType: 'text/html',
          href: this.Actor.url
        }
      ] as ActivityUrlObject[],

      playerSettings: getLocalActorPlayerSettingsActivityPubUrl(this.Actor),

      summary: this.description,
      support: this.support,
      postingRestrictedToMods: true,
      attributedTo: [
        this.Account.Actor.url
      ]
    }
  }

  // Avoid error when running this method on MAccount... | MChannel...
  getClientUrl (this: MAccountIdHost | MChannelIdHost, videosSuffix = true) {
    const suffix = videosSuffix
      ? '/videos'
      : ''

    return WEBSERVER.URL + '/c/' + this.Actor.getIdentifier() + suffix
  }

  getClientManageUrl (this: MAccountIdHost | MChannelIdHost) {
    return WEBSERVER.URL + '/my-library/video-channels/manage/' + this.Actor.getIdentifier()
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
