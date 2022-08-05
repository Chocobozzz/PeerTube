import { join } from 'path'
import { FindOptions, Includeable, literal, Op, ScopeOptions, Sequelize, Transaction, WhereOptions } from 'sequelize'
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
  Model,
  Scopes,
  Table,
  UpdatedAt
} from 'sequelize-typescript'
import { activityPubCollectionPagination } from '@server/lib/activitypub/collection'
import { MAccountId, MChannelId } from '@server/types/models'
import { buildPlaylistEmbedPath, buildPlaylistWatchPath, pick } from '@shared/core-utils'
import { buildUUID, uuidToShort } from '@shared/extra-utils'
import { AttributesOnly } from '@shared/typescript-utils'
import { ActivityIconObject } from '../../../shared/models/activitypub/objects'
import { PlaylistObject } from '../../../shared/models/activitypub/objects/playlist-object'
import { VideoPlaylistPrivacy } from '../../../shared/models/videos/playlist/video-playlist-privacy.model'
import { VideoPlaylistType } from '../../../shared/models/videos/playlist/video-playlist-type.model'
import { VideoPlaylist } from '../../../shared/models/videos/playlist/video-playlist.model'
import { isActivityPubUrlValid } from '../../helpers/custom-validators/activitypub/misc'
import {
  isVideoPlaylistDescriptionValid,
  isVideoPlaylistNameValid,
  isVideoPlaylistPrivacyValid
} from '../../helpers/custom-validators/video-playlists'
import {
  ACTIVITY_PUB,
  CONSTRAINTS_FIELDS,
  STATIC_PATHS,
  THUMBNAILS_SIZE,
  VIDEO_PLAYLIST_PRIVACIES,
  VIDEO_PLAYLIST_TYPES,
  WEBSERVER
} from '../../initializers/constants'
import { MThumbnail } from '../../types/models/video/thumbnail'
import {
  MVideoPlaylistAccountThumbnail,
  MVideoPlaylistAP,
  MVideoPlaylistFormattable,
  MVideoPlaylistFull,
  MVideoPlaylistFullSummary,
  MVideoPlaylistIdWithElements
} from '../../types/models/video/video-playlist'
import { AccountModel, ScopeNames as AccountScopeNames, SummaryOptions } from '../account/account'
import { ActorModel } from '../actor/actor'
import { setAsUpdated } from '../shared'
import {
  buildServerIdsFollowedBy,
  buildTrigramSearchIndex,
  buildWhereIdOrUUID,
  createSimilarityAttribute,
  getPlaylistSort,
  isOutdated,
  throwIfNotValid
} from '../utils'
import { ThumbnailModel } from './thumbnail'
import { ScopeNames as VideoChannelScopeNames, VideoChannelModel } from './video-channel'
import { VideoPlaylistElementModel } from './video-playlist-element'

enum ScopeNames {
  AVAILABLE_FOR_LIST = 'AVAILABLE_FOR_LIST',
  WITH_VIDEOS_LENGTH = 'WITH_VIDEOS_LENGTH',
  WITH_ACCOUNT_AND_CHANNEL_SUMMARY = 'WITH_ACCOUNT_AND_CHANNEL_SUMMARY',
  WITH_ACCOUNT = 'WITH_ACCOUNT',
  WITH_THUMBNAIL = 'WITH_THUMBNAIL',
  WITH_ACCOUNT_AND_CHANNEL = 'WITH_ACCOUNT_AND_CHANNEL'
}

type AvailableForListOptions = {
  followerActorId?: number
  type?: VideoPlaylistType
  accountId?: number
  videoChannelId?: number
  listMyPlaylists?: boolean
  search?: string
  host?: string
  uuids?: string[]
  withVideos?: boolean
  forCount?: boolean
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
  },
  [ScopeNames.AVAILABLE_FOR_LIST]: (options: AvailableForListOptions) => {
    const whereAnd: WhereOptions[] = []

    const whereServer = options.host && options.host !== WEBSERVER.HOST
      ? { host: options.host }
      : undefined

    let whereActor: WhereOptions = {}

    if (options.host === WEBSERVER.HOST) {
      whereActor = {
        [Op.and]: [ { serverId: null } ]
      }
    }

    if (options.listMyPlaylists !== true) {
      whereAnd.push({
        privacy: VideoPlaylistPrivacy.PUBLIC
      })

      // Only list local playlists
      const whereActorOr: WhereOptions[] = [
        {
          serverId: null
        }
      ]

      // … OR playlists that are on an instance followed by actorId
      if (options.followerActorId) {
        const inQueryInstanceFollow = buildServerIdsFollowedBy(options.followerActorId)

        whereActorOr.push({
          serverId: {
            [Op.in]: literal(inQueryInstanceFollow)
          }
        })
      }

      Object.assign(whereActor, { [Op.or]: whereActorOr })
    }

    if (options.accountId) {
      whereAnd.push({
        ownerAccountId: options.accountId
      })
    }

    if (options.videoChannelId) {
      whereAnd.push({
        videoChannelId: options.videoChannelId
      })
    }

    if (options.type) {
      whereAnd.push({
        type: options.type
      })
    }

    if (options.uuids) {
      whereAnd.push({
        uuid: {
          [Op.in]: options.uuids
        }
      })
    }

    if (options.withVideos === true) {
      whereAnd.push(
        literal(`(${getVideoLengthSelect()}) != 0`)
      )
    }

    let attributesInclude: any[] = [ literal('0 as similarity') ]

    if (options.search) {
      const escapedSearch = VideoPlaylistModel.sequelize.escape(options.search)
      const escapedLikeSearch = VideoPlaylistModel.sequelize.escape('%' + options.search + '%')
      attributesInclude = [ createSimilarityAttribute('VideoPlaylistModel.name', options.search) ]

      whereAnd.push({
        [Op.or]: [
          Sequelize.literal(
            'lower(immutable_unaccent("VideoPlaylistModel"."name")) % lower(immutable_unaccent(' + escapedSearch + '))'
          ),
          Sequelize.literal(
            'lower(immutable_unaccent("VideoPlaylistModel"."name")) LIKE lower(immutable_unaccent(' + escapedLikeSearch + '))'
          )
        ]
      })
    }

    const where = {
      [Op.and]: whereAnd
    }

    const include: Includeable[] = [
      {
        model: AccountModel.scope({
          method: [ AccountScopeNames.SUMMARY, { whereActor, whereServer, forCount: options.forCount } as SummaryOptions ]
        }),
        required: true
      }
    ]

    if (options.forCount !== true) {
      include.push({
        model: VideoChannelModel.scope(VideoChannelScopeNames.SUMMARY),
        required: false
      })
    }

    return {
      attributes: {
        include: attributesInclude
      },
      where,
      include
    } as FindOptions
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
export class VideoPlaylistModel extends Model<Partial<AttributesOnly<VideoPlaylistModel>>> {
  @CreatedAt
  createdAt: Date

  @UpdatedAt
  updatedAt: Date

  @AllowNull(false)
  @Is('VideoPlaylistName', value => throwIfNotValid(value, isVideoPlaylistNameValid, 'name'))
  @Column
  name: string

  @AllowNull(true)
  @Is('VideoPlaylistDescription', value => throwIfNotValid(value, isVideoPlaylistDescriptionValid, 'description', true))
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.VIDEO_PLAYLISTS.DESCRIPTION.max))
  description: string

  @AllowNull(false)
  @Is('VideoPlaylistPrivacy', value => throwIfNotValid(value, isVideoPlaylistPrivacyValid, 'privacy'))
  @Column
  privacy: VideoPlaylistPrivacy

  @AllowNull(false)
  @Is('VideoPlaylistUrl', value => throwIfNotValid(value, isActivityPubUrlValid, 'url'))
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.VIDEO_PLAYLISTS.URL.max))
  url: string

  @AllowNull(false)
  @Default(DataType.UUIDV4)
  @IsUUID(4)
  @Column(DataType.UUID)
  uuid: string

  @AllowNull(false)
  @Default(VideoPlaylistType.REGULAR)
  @Column
  type: VideoPlaylistType

  @ForeignKey(() => AccountModel)
  @Column
  ownerAccountId: number

  @BelongsTo(() => AccountModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'CASCADE'
  })
  OwnerAccount: AccountModel

  @ForeignKey(() => VideoChannelModel)
  @Column
  videoChannelId: number

  @BelongsTo(() => VideoChannelModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'CASCADE'
  })
  VideoChannel: VideoChannelModel

  @HasMany(() => VideoPlaylistElementModel, {
    foreignKey: {
      name: 'videoPlaylistId',
      allowNull: false
    },
    onDelete: 'CASCADE'
  })
  VideoPlaylistElements: VideoPlaylistElementModel[]

  @HasOne(() => ThumbnailModel, {
    foreignKey: {
      name: 'videoPlaylistId',
      allowNull: true
    },
    onDelete: 'CASCADE',
    hooks: true
  })
  Thumbnail: ThumbnailModel

  static listForApi (options: AvailableForListOptions & {
    start: number
    count: number
    sort: string
  }) {
    const query = {
      offset: options.start,
      limit: options.count,
      order: getPlaylistSort(options.sort)
    }

    const commonAvailableForListOptions = pick(options, [
      'type',
      'followerActorId',
      'accountId',
      'videoChannelId',
      'listMyPlaylists',
      'search',
      'host',
      'uuids'
    ])

    const scopesFind: (string | ScopeOptions)[] = [
      {
        method: [
          ScopeNames.AVAILABLE_FOR_LIST,
          {
            ...commonAvailableForListOptions,

            withVideos: options.withVideos || false
          } as AvailableForListOptions
        ]
      },
      ScopeNames.WITH_VIDEOS_LENGTH,
      ScopeNames.WITH_THUMBNAIL
    ]

    const scopesCount: (string | ScopeOptions)[] = [
      {
        method: [
          ScopeNames.AVAILABLE_FOR_LIST,

          {
            ...commonAvailableForListOptions,

            withVideos: options.withVideos || false,
            forCount: true
          } as AvailableForListOptions
        ]
      },
      ScopeNames.WITH_VIDEOS_LENGTH
    ]

    return Promise.all([
      VideoPlaylistModel.scope(scopesCount).count(),
      VideoPlaylistModel.scope(scopesFind).findAll(query)
    ]).then(([ count, rows ]) => ({ total: count, data: rows }))
  }

  static searchForApi (options: Pick<AvailableForListOptions, 'followerActorId' | 'search' | 'host' | 'uuids'> & {
    start: number
    count: number
    sort: string
  }) {
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

  static listPlaylistIdsOf (accountId: number, videoIds: number[]): Promise<MVideoPlaylistIdWithElements[]> {
    const query = {
      attributes: [ 'id' ],
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

  static getPrivacyLabel (privacy: VideoPlaylistPrivacy) {
    return VIDEO_PLAYLIST_PRIVACIES[privacy] || 'Unknown'
  }

  static getTypeLabel (type: VideoPlaylistType) {
    return VIDEO_PLAYLIST_TYPES[type] || 'Unknown'
  }

  static resetPlaylistsOfChannel (videoChannelId: number, transaction: Transaction) {
    const query = {
      where: {
        videoChannelId
      },
      transaction
    }

    return VideoPlaylistModel.update({ privacy: VideoPlaylistPrivacy.PRIVATE, videoChannelId: null }, query)
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

  generateThumbnailName () {
    const extension = '.jpg'

    return 'playlist-' + buildUUID() + extension
  }

  getThumbnailUrl () {
    if (!this.hasThumbnail()) return null

    return WEBSERVER.URL + STATIC_PATHS.THUMBNAILS + this.Thumbnail.filename
  }

  getThumbnailStaticPath () {
    if (!this.hasThumbnail()) return null

    return join(STATIC_PATHS.THUMBNAILS, this.Thumbnail.filename)
  }

  getWatchStaticPath () {
    return buildPlaylistWatchPath({ shortUUID: uuidToShort(this.uuid) })
  }

  getEmbedStaticPath () {
    return buildPlaylistEmbedPath(this)
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
    return setAsUpdated('videoPlaylist', this.id)
  }

  setVideosLength (videosLength: number) {
    this.set('videosLength' as any, videosLength, { raw: true })
  }

  isOwned () {
    return this.OwnerAccount.isOwned()
  }

  isOutdated () {
    if (this.isOwned()) return false

    return isOutdated(this, ACTIVITY_PUB.VIDEO_PLAYLIST_REFRESH_INTERVAL)
  }

  toFormattedJSON (this: MVideoPlaylistFormattable): VideoPlaylist {
    return {
      id: this.id,
      uuid: this.uuid,
      shortUUID: uuidToShort(this.uuid),

      isLocal: this.isOwned(),

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
          published: this.createdAt.toISOString(),
          updated: this.updatedAt.toISOString(),
          attributedTo: this.VideoChannel ? [ this.VideoChannel.Actor.url ] : [],
          icon
        })
      })
  }
}
