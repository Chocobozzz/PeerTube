import { buildPlaylistEmbedPath, buildPlaylistWatchPath } from '@peertube/peertube-core-utils'
import {
  ActivityIconObject,
  PlaylistObject,
  VideoPlaylist,
  VideoPlaylistPrivacy,
  VideoPlaylistType,
  type VideoPlaylistPrivacyType,
  type VideoPlaylistType_Type
} from '@peertube/peertube-models'
import { buildUUID, uuidToShort } from '@peertube/peertube-node-utils'
import { activityPubCollectionPagination } from '@server/lib/activitypub/collection.js'
import { MAccountId, MChannelId, MVideoPlaylistElement } from '@server/types/models/index.js'
import { join } from 'path'
import { FindOptions, Op, Transaction, literal } from 'sequelize'
import {
  AllowNull,
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  Default,
  ForeignKey,
  HasMany,
  HasOne,
  Is,
  IsUUID,
  Scopes,
  Table,
  UpdatedAt
} from 'sequelize-typescript'
import { isActivityPubUrlValid } from '../../helpers/custom-validators/activitypub/misc.js'
import {
  isVideoPlaylistDescriptionValid,
  isVideoPlaylistNameValid,
  isVideoPlaylistPrivacyValid
} from '../../helpers/custom-validators/video-playlists.js'
import {
  ACTIVITY_PUB,
  CONSTRAINTS_FIELDS,
  LAZY_STATIC_PATHS,
  THUMBNAILS_SIZE,
  USER_EXPORT_MAX_ITEMS,
  VIDEO_PLAYLIST_PRIVACIES,
  VIDEO_PLAYLIST_TYPES,
  WEBSERVER
} from '../../initializers/constants.js'
import { MThumbnail } from '../../types/models/video/thumbnail.js'
import {
  MVideoPlaylist,
  MVideoPlaylistAP,
  MVideoPlaylistAccountThumbnail,
  MVideoPlaylistFormattable,
  MVideoPlaylistFull,
  MVideoPlaylistFullSummary,
  MVideoPlaylistSummaryWithElements
} from '../../types/models/video/video-playlist.js'
import { AccountModel, ScopeNames as AccountScopeNames } from '../account/account.js'
import { ActorModel } from '../actor/actor.js'
import {
  SequelizeModel,
  buildSQLAttributes,
  buildTrigramSearchIndex,
  buildWhereIdOrUUID,
  isOutdated,
  setAsUpdated,
  throwIfNotValid
} from '../shared/index.js'
import { getNextPositionOf, increasePositionOf, reassignPositionOf } from '../shared/position.js'
import { ListVideoPlaylistsOptions, VideoPlaylistListQueryBuilder } from './sql/playlist/video-playlist-list-query-builder.js'
import { ThumbnailModel } from './thumbnail.js'
import { VideoChannelModel, ScopeNames as VideoChannelScopeNames } from './video-channel.js'
import { VideoPlaylistElementModel } from './video-playlist-element.js'

enum ScopeNames {
  WITH_VIDEOS_LENGTH = 'WITH_VIDEOS_LENGTH',
  WITH_ACCOUNT_AND_CHANNEL_SUMMARY = 'WITH_ACCOUNT_AND_CHANNEL_SUMMARY',
  WITH_ACCOUNT = 'WITH_ACCOUNT',
  WITH_THUMBNAIL = 'WITH_THUMBNAIL',
  WITH_ACCOUNT_AND_CHANNEL = 'WITH_ACCOUNT_AND_CHANNEL'
}

function getVideoLengthSelect () {
  return 'SELECT COUNT("id") FROM "videoPlaylistElement" WHERE "videoPlaylistId" = "VideoPlaylistModel"."id"'
}

@Scopes(() => ({
  [ScopeNames.WITH_THUMBNAIL]: {
    include: [
      {
        model: ThumbnailModel,
        required: false
      }
    ]
  },
  [ScopeNames.WITH_VIDEOS_LENGTH]: {
    attributes: {
      include: [
        [
          literal(`(${getVideoLengthSelect()})`),
          'videosLength'
        ]
      ]
    }
  } as FindOptions,
  [ScopeNames.WITH_ACCOUNT]: {
    include: [
      {
        model: AccountModel,
        required: true
      }
    ]
  },
  [ScopeNames.WITH_ACCOUNT_AND_CHANNEL_SUMMARY]: {
    include: [
      {
        model: AccountModel.scope(AccountScopeNames.SUMMARY),
        required: true
      },
      {
        model: VideoChannelModel.scope(VideoChannelScopeNames.SUMMARY),
        required: false
      }
    ]
  },
  [ScopeNames.WITH_ACCOUNT_AND_CHANNEL]: {
    include: [
      {
        model: AccountModel,
        required: true
      },
      {
        model: VideoChannelModel,
        required: false
      }
    ]
  }
}))
@Table({
  tableName: 'videoPlaylist',
  indexes: [
    buildTrigramSearchIndex('video_playlist_name_trigram', 'name'),

    {
      fields: [ 'ownerAccountId' ]
    },
    {
      fields: [ 'videoChannelId' ]
    },
    {
      fields: [ 'url' ],
      unique: true
    }
  ]
})
export class VideoPlaylistModel extends SequelizeModel<VideoPlaylistModel> {
  @CreatedAt
  declare createdAt: Date

  @UpdatedAt
  declare updatedAt: Date

  @AllowNull(false)
  @Is('VideoPlaylistName', value => throwIfNotValid(value, isVideoPlaylistNameValid, 'name'))
  @Column
  declare name: string

  @AllowNull(true)
  @Is('VideoPlaylistDescription', value => throwIfNotValid(value, isVideoPlaylistDescriptionValid, 'description', true))
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.VIDEO_PLAYLISTS.DESCRIPTION.max))
  declare description: string

  @AllowNull(false)
  @Is('VideoPlaylistPrivacy', value => throwIfNotValid(value, isVideoPlaylistPrivacyValid, 'privacy'))
  @Column
  declare privacy: VideoPlaylistPrivacyType

  @AllowNull(false)
  @Is('VideoPlaylistUrl', value => throwIfNotValid(value, isActivityPubUrlValid, 'url'))
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.VIDEO_PLAYLISTS.URL.max))
  declare url: string

  @AllowNull(false)
  @Default(DataType.UUIDV4)
  @IsUUID(4)
  @Column(DataType.UUID)
  declare uuid: string

  @AllowNull(false)
  @Default(VideoPlaylistType.REGULAR)
  @Column
  declare type: VideoPlaylistType_Type

  @AllowNull(true)
  @Column
  declare videoChannelPosition: number

  @ForeignKey(() => AccountModel)
  @Column
  declare ownerAccountId: number

  @BelongsTo(() => AccountModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'CASCADE'
  })
  declare OwnerAccount: Awaited<AccountModel>

  @ForeignKey(() => VideoChannelModel)
  @Column
  declare videoChannelId: number

  @BelongsTo(() => VideoChannelModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'CASCADE'
  })
  declare VideoChannel: Awaited<VideoChannelModel>

  @HasMany(() => VideoPlaylistElementModel, {
    foreignKey: {
      name: 'videoPlaylistId',
      allowNull: false
    },
    onDelete: 'CASCADE'
  })
  declare VideoPlaylistElements: Awaited<VideoPlaylistElementModel>[]

  @HasOne(() => ThumbnailModel, {
    foreignKey: {
      name: 'videoPlaylistId',
      allowNull: true
    },
    onDelete: 'CASCADE',
    hooks: true
  })
  declare Thumbnail: Awaited<ThumbnailModel>

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
      includeAttributes: [ 'id', 'name', 'type' ]
    })
  }

  // ---------------------------------------------------------------------------

  static listForApi (options: ListVideoPlaylistsOptions) {
    return Promise.all([
      new VideoPlaylistListQueryBuilder(VideoPlaylistModel.sequelize, options).list<MVideoPlaylistFormattable>(),
      new VideoPlaylistListQueryBuilder(VideoPlaylistModel.sequelize, options).count()
    ]).then(([ rows, count ]) => {
      return { total: count, data: rows }
    })
  }

  static searchForApi (
    options: Pick<ListVideoPlaylistsOptions, 'followerActorId' | 'search' | 'host' | 'uuids' | 'start' | 'count' | 'sort'>
  ) {
    return VideoPlaylistModel.listForApi({
      ...options,

      type: VideoPlaylistType.REGULAR,
      listMyPlaylists: false,
      withVideos: true
    })
  }

  static listPublicUrlsOfForAP (options: { account?: MAccountId, channel?: MChannelId }, start: number, count: number) {
    const where = {
      privacy: VideoPlaylistPrivacy.PUBLIC
    }

    if (options.account) {
      Object.assign(where, { ownerAccountId: options.account.id })
    }

    if (options.channel) {
      Object.assign(where, { videoChannelId: options.channel.id })
    }

    const getQuery = (forCount: boolean) => {
      return {
        attributes: forCount === true
          ? []
          : [ 'url' ],
        offset: start,
        limit: count,
        where
      }
    }

    return Promise.all([
      VideoPlaylistModel.count(getQuery(true)),
      VideoPlaylistModel.findAll(getQuery(false))
    ]).then(([ total, rows ]) => ({
      total,
      data: rows.map(p => p.url)
    }))
  }

  static listPlaylistSummariesOf (accountId: number, videoIds: number[]): Promise<MVideoPlaylistSummaryWithElements[]> {
    const query = {
      attributes: [ 'id', 'name', 'uuid' ],
      where: {
        ownerAccountId: accountId
      },
      include: [
        {
          attributes: [ 'id', 'videoId', 'startTimestamp', 'stopTimestamp' ],
          model: VideoPlaylistElementModel.unscoped(),
          where: {
            videoId: {
              [Op.in]: videoIds
            }
          },
          required: true
        }
      ]
    }

    return VideoPlaylistModel.findAll(query)
  }

  static listPlaylistForExport (accountId: number): Promise<MVideoPlaylistFull[]> {
    return VideoPlaylistModel
      .scope([ ScopeNames.WITH_ACCOUNT_AND_CHANNEL, ScopeNames.WITH_VIDEOS_LENGTH, ScopeNames.WITH_THUMBNAIL ])
      .findAll({
        where: {
          ownerAccountId: accountId
        },
        limit: USER_EXPORT_MAX_ITEMS
      })
  }

  static listPlaylistOfChannel (channelId: number, transaction: Transaction): Promise<MVideoPlaylistFull[]> {
    return VideoPlaylistModel
      .scope([ ScopeNames.WITH_ACCOUNT_AND_CHANNEL, ScopeNames.WITH_VIDEOS_LENGTH, ScopeNames.WITH_THUMBNAIL ])
      .findAll({
        where: {
          videoChannelId: channelId
        },
        limit: 150,
        transaction
      })
  }

  // ---------------------------------------------------------------------------

  static doesPlaylistExist (url: string) {
    const query = {
      attributes: [ 'id' ],
      where: {
        url
      }
    }

    return VideoPlaylistModel
      .findOne(query)
      .then(e => !!e)
  }

  static loadWithAccountAndChannelSummary (id: number | string, transaction: Transaction): Promise<MVideoPlaylistFullSummary> {
    const where = buildWhereIdOrUUID(id)

    const query = {
      where,
      transaction
    }

    return VideoPlaylistModel
      .scope([ ScopeNames.WITH_ACCOUNT_AND_CHANNEL_SUMMARY, ScopeNames.WITH_VIDEOS_LENGTH, ScopeNames.WITH_THUMBNAIL ])
      .findOne(query)
  }

  static loadWithAccountAndChannel (id: number | string, transaction: Transaction): Promise<MVideoPlaylistFull> {
    const where = buildWhereIdOrUUID(id)

    const query = {
      where,
      transaction
    }

    return VideoPlaylistModel
      .scope([ ScopeNames.WITH_ACCOUNT_AND_CHANNEL, ScopeNames.WITH_VIDEOS_LENGTH, ScopeNames.WITH_THUMBNAIL ])
      .findOne(query)
  }

  static loadByUrlAndPopulateAccount (url: string): Promise<MVideoPlaylistAccountThumbnail> {
    const query = {
      where: {
        url
      }
    }

    return VideoPlaylistModel.scope([ ScopeNames.WITH_ACCOUNT, ScopeNames.WITH_THUMBNAIL ]).findOne(query)
  }

  static loadByUrlWithAccountAndChannelSummary (url: string): Promise<MVideoPlaylistFullSummary> {
    const query = {
      where: {
        url
      }
    }

    return VideoPlaylistModel
      .scope([ ScopeNames.WITH_ACCOUNT_AND_CHANNEL_SUMMARY, ScopeNames.WITH_VIDEOS_LENGTH, ScopeNames.WITH_THUMBNAIL ])
      .findOne(query)
  }

  static loadWatchLaterOf (account: MAccountId): Promise<MVideoPlaylistFull> {
    const query = {
      where: {
        type: VideoPlaylistType.WATCH_LATER,
        ownerAccountId: account.id
      }
    }

    return VideoPlaylistModel
      .scope([ ScopeNames.WITH_ACCOUNT_AND_CHANNEL, ScopeNames.WITH_VIDEOS_LENGTH, ScopeNames.WITH_THUMBNAIL ])
      .findOne(query)
  }

  static loadRegularByAccountAndName (account: MAccountId, name: string): Promise<MVideoPlaylist> {
    const query = {
      where: {
        type: VideoPlaylistType.REGULAR,
        name,
        ownerAccountId: account.id
      }
    }

    return VideoPlaylistModel
      .findOne(query)
  }

  // ---------------------------------------------------------------------------

  static getNextPositionOf (options: {
    videoChannelId: number
    transaction?: Transaction
  }) {
    const { videoChannelId, transaction } = options

    return getNextPositionOf({
      model: VideoPlaylistModel,
      columnName: 'videoChannelPosition',
      where: { videoChannelId },
      transaction
    })
  }

  static reassignPositionOf (options: {
    videoChannelId: number
    firstPosition: number
    endPosition: number
    newPosition: number
    transaction?: Transaction
  }) {
    const { videoChannelId, firstPosition, endPosition, newPosition, transaction } = options

    return reassignPositionOf({
      model: VideoPlaylistModel,
      columnName: 'videoChannelPosition',
      where: { videoChannelId },
      transaction,

      firstPosition,
      endPosition,
      newPosition
    })
  }

  static increasePositionOf (options: {
    videoChannelId: number
    fromPosition: number
    by: number
    transaction?: Transaction
  }) {
    const { videoChannelId, fromPosition, by, transaction } = options

    return increasePositionOf({
      model: VideoPlaylistModel,
      columnName: 'videoChannelPosition',
      where: { videoChannelId },
      transaction,

      fromPosition,
      by
    })
  }

  // ---------------------------------------------------------------------------

  static getPrivacyLabel (privacy: VideoPlaylistPrivacyType) {
    return VIDEO_PLAYLIST_PRIVACIES[privacy] || 'Unknown'
  }

  static getTypeLabel (type: VideoPlaylistType_Type) {
    return VIDEO_PLAYLIST_TYPES[type] || 'Unknown'
  }

  static resetPlaylistsOfChannel (videoChannelId: number, transaction: Transaction) {
    const query = {
      where: {
        videoChannelId
      },
      transaction
    }

    return VideoPlaylistModel.update({
      privacy: VideoPlaylistPrivacy.PRIVATE,
      videoChannelId: null,
      videoChannelPosition: null
    }, query)
  }

  async setAndSaveThumbnail (thumbnail: MThumbnail, t: Transaction) {
    thumbnail.videoPlaylistId = this.id

    this.Thumbnail = await thumbnail.save({ transaction: t })
  }

  hasThumbnail () {
    return !!this.Thumbnail
  }

  hasGeneratedThumbnail () {
    return this.hasThumbnail() && this.Thumbnail.automaticallyGenerated === true
  }

  shouldGenerateThumbnailWithNewElement (newElement: MVideoPlaylistElement) {
    if (this.hasThumbnail() === false) return true
    if (newElement.position === 1 && this.hasGeneratedThumbnail()) return true

    return false
  }

  generateThumbnailName () {
    const extension = '.jpg'

    return 'playlist-' + buildUUID() + extension
  }

  getThumbnailUrl () {
    if (!this.hasThumbnail()) return null

    return WEBSERVER.URL + LAZY_STATIC_PATHS.THUMBNAILS + this.Thumbnail.filename
  }

  getThumbnailStaticPath () {
    if (!this.hasThumbnail()) return null

    return join(LAZY_STATIC_PATHS.THUMBNAILS, this.Thumbnail.filename)
  }

  getWatchStaticPath () {
    return buildPlaylistWatchPath({ shortUUID: uuidToShort(this.uuid) })
  }

  getEmbedStaticPath () {
    return buildPlaylistEmbedPath({ shortUUID: uuidToShort(this.uuid) })
  }

  static async getStats () {
    const totalLocalPlaylists = await VideoPlaylistModel.count({
      include: [
        {
          model: AccountModel.unscoped(),
          required: true,
          include: [
            {
              model: ActorModel.unscoped(),
              required: true,
              where: {
                serverId: null
              }
            }
          ]
        }
      ],
      where: {
        privacy: VideoPlaylistPrivacy.PUBLIC
      }
    })

    return {
      totalLocalPlaylists
    }
  }

  setAsRefreshed () {
    return setAsUpdated({ sequelize: this.sequelize, table: 'videoPlaylist', id: this.id })
  }

  setVideosLength (videosLength: number) {
    this.set('videosLength' as any, videosLength, { raw: true })
  }

  isLocal () {
    return this.OwnerAccount.isLocal()
  }

  isOutdated () {
    if (this.isLocal()) return false

    return isOutdated(this, ACTIVITY_PUB.VIDEO_PLAYLIST_REFRESH_INTERVAL)
  }

  toFormattedJSON (this: MVideoPlaylistFormattable): VideoPlaylist {
    return {
      id: this.id,
      uuid: this.uuid,
      shortUUID: uuidToShort(this.uuid),

      isLocal: this.isLocal(),

      url: this.url,

      displayName: this.name,
      description: this.description,
      privacy: {
        id: this.privacy,
        label: VideoPlaylistModel.getPrivacyLabel(this.privacy)
      },

      thumbnailPath: this.getThumbnailStaticPath(),
      embedPath: this.getEmbedStaticPath(),

      type: {
        id: this.type,
        label: VideoPlaylistModel.getTypeLabel(this.type)
      },

      videosLength: this.get('videosLength') as number,

      createdAt: this.createdAt,
      updatedAt: this.updatedAt,

      ownerAccount: this.OwnerAccount.toFormattedSummaryJSON(),

      videoChannelPosition: this.videoChannelPosition,
      videoChannel: this.VideoChannel
        ? this.VideoChannel.toFormattedSummaryJSON()
        : null
    }
  }

  toActivityPubObject (this: MVideoPlaylistAP, page: number, t: Transaction): Promise<PlaylistObject> {
    const handler = (start: number, count: number) => {
      return VideoPlaylistElementModel.listUrlsOfForAP(this.id, start, count, t)
    }

    let icon: ActivityIconObject
    if (this.hasThumbnail()) {
      icon = {
        type: 'Image' as 'Image',
        url: this.getThumbnailUrl(),
        mediaType: 'image/jpeg' as 'image/jpeg',
        width: THUMBNAILS_SIZE.width,
        height: THUMBNAILS_SIZE.height
      }
    }

    return activityPubCollectionPagination(this.url, handler, page)
      .then(o => {
        return Object.assign(o, {
          type: 'Playlist' as 'Playlist',
          name: this.name,
          content: this.description,
          mediaType: 'text/markdown' as 'text/markdown',
          uuid: this.uuid,
          videoChannelPosition: this.videoChannelPosition,
          published: this.createdAt.toISOString(),
          updated: this.updatedAt.toISOString(),
          attributedTo: this.VideoChannel ? [ this.VideoChannel.Actor.url ] : [],
          icon
        })
      })
  }
}
