import Bluebird from 'bluebird'
import { remove } from 'fs-extra'
import { maxBy, minBy } from 'lodash'
import { join } from 'path'
import { FindOptions, Includeable, IncludeOptions, Op, QueryTypes, ScopeOptions, Sequelize, Transaction, WhereOptions } from 'sequelize'
import {
  AllowNull,
  BeforeDestroy,
  BelongsTo,
  BelongsToMany,
  Column,
  CreatedAt,
  DataType,
  Default,
  ForeignKey,
  HasMany,
  HasOne,
  Is,
  IsInt,
  IsUUID,
  Min,
  Model,
  Scopes,
  Table,
  UpdatedAt
} from 'sequelize-typescript'
import { getPrivaciesForFederation, isPrivacyForFederation, isStateForFederation } from '@server/helpers/video'
import { LiveManager } from '@server/lib/live/live-manager'
import { removeHLSFileObjectStorage, removeHLSObjectStorage, removeWebTorrentObjectStorage } from '@server/lib/object-storage'
import { tracer } from '@server/lib/opentelemetry/tracing'
import { getHLSDirectory, getHLSRedundancyDirectory, getHlsResolutionPlaylistFilename } from '@server/lib/paths'
import { VideoPathManager } from '@server/lib/video-path-manager'
import { getServerActor } from '@server/models/application/application'
import { ModelCache } from '@server/models/model-cache'
import { buildVideoEmbedPath, buildVideoWatchPath, pick } from '@shared/core-utils'
import { ffprobePromise, getAudioStream, uuidToShort } from '@shared/extra-utils'
import {
  ResultList,
  ThumbnailType,
  UserRight,
  Video,
  VideoDetails,
  VideoFile,
  VideoInclude,
  VideoObject,
  VideoPrivacy,
  VideoRateType,
  VideoState,
  VideoStorage,
  VideoStreamingPlaylistType
} from '@shared/models'
import { AttributesOnly } from '@shared/typescript-utils'
import { peertubeTruncate } from '../../helpers/core-utils'
import { isActivityPubUrlValid } from '../../helpers/custom-validators/activitypub/misc'
import { exists, isBooleanValid } from '../../helpers/custom-validators/misc'
import {
  isVideoDescriptionValid,
  isVideoDurationValid,
  isVideoNameValid,
  isVideoPrivacyValid,
  isVideoStateValid,
  isVideoSupportValid
} from '../../helpers/custom-validators/videos'
import { getVideoStreamDimensionsInfo } from '../../helpers/ffmpeg'
import { logger } from '../../helpers/logger'
import { CONFIG } from '../../initializers/config'
import { ACTIVITY_PUB, API_VERSION, CONSTRAINTS_FIELDS, LAZY_STATIC_PATHS, STATIC_PATHS, WEBSERVER } from '../../initializers/constants'
import { sendDeleteVideo } from '../../lib/activitypub/send'
import {
  MChannel,
  MChannelAccountDefault,
  MChannelId,
  MStreamingPlaylist,
  MStreamingPlaylistFilesVideo,
  MUserAccountId,
  MUserId,
  MVideo,
  MVideoAccountLight,
  MVideoAccountLightBlacklistAllFiles,
  MVideoAP,
  MVideoDetails,
  MVideoFileVideo,
  MVideoFormattable,
  MVideoFormattableDetails,
  MVideoForUser,
  MVideoFullLight,
  MVideoId,
  MVideoImmutable,
  MVideoThumbnail,
  MVideoThumbnailBlacklist,
  MVideoWithAllFiles,
  MVideoWithFile
} from '../../types/models'
import { MThumbnail } from '../../types/models/video/thumbnail'
import { MVideoFile, MVideoFileStreamingPlaylistVideo } from '../../types/models/video/video-file'
import { VideoAbuseModel } from '../abuse/video-abuse'
import { AccountModel } from '../account/account'
import { AccountVideoRateModel } from '../account/account-video-rate'
import { ActorModel } from '../actor/actor'
import { ActorImageModel } from '../actor/actor-image'
import { VideoRedundancyModel } from '../redundancy/video-redundancy'
import { ServerModel } from '../server/server'
import { TrackerModel } from '../server/tracker'
import { VideoTrackerModel } from '../server/video-tracker'
import { setAsUpdated } from '../shared'
import { UserModel } from '../user/user'
import { UserVideoHistoryModel } from '../user/user-video-history'
import { buildTrigramSearchIndex, buildWhereIdOrUUID, getVideoSort, isOutdated, throwIfNotValid } from '../utils'
import { VideoViewModel } from '../view/video-view'
import {
  videoFilesModelToFormattedJSON,
  VideoFormattingJSONOptions,
  videoModelToActivityPubObject,
  videoModelToFormattedDetailsJSON,
  videoModelToFormattedJSON
} from './formatter/video-format-utils'
import { ScheduleVideoUpdateModel } from './schedule-video-update'
import {
  BuildVideosListQueryOptions,
  DisplayOnlyForFollowerOptions,
  VideoModelGetQueryBuilder,
  VideosIdListQueryBuilder,
  VideosModelListQueryBuilder
} from './sql/video'
import { TagModel } from './tag'
import { ThumbnailModel } from './thumbnail'
import { VideoBlacklistModel } from './video-blacklist'
import { VideoCaptionModel } from './video-caption'
import { ScopeNames as VideoChannelScopeNames, SummaryOptions, VideoChannelModel } from './video-channel'
import { VideoCommentModel } from './video-comment'
import { VideoFileModel } from './video-file'
import { VideoImportModel } from './video-import'
import { VideoJobInfoModel } from './video-job-info'
import { VideoLiveModel } from './video-live'
import { VideoPlaylistElementModel } from './video-playlist-element'
import { VideoShareModel } from './video-share'
import { VideoSourceModel } from './video-source'
import { VideoStreamingPlaylistModel } from './video-streaming-playlist'
import { VideoTagModel } from './video-tag'

export enum ScopeNames {
  FOR_API = 'FOR_API',
  WITH_ACCOUNT_DETAILS = 'WITH_ACCOUNT_DETAILS',
  WITH_TAGS = 'WITH_TAGS',
  WITH_WEBTORRENT_FILES = 'WITH_WEBTORRENT_FILES',
  WITH_SCHEDULED_UPDATE = 'WITH_SCHEDULED_UPDATE',
  WITH_BLACKLISTED = 'WITH_BLACKLISTED',
  WITH_STREAMING_PLAYLISTS = 'WITH_STREAMING_PLAYLISTS',
  WITH_IMMUTABLE_ATTRIBUTES = 'WITH_IMMUTABLE_ATTRIBUTES',
  WITH_USER_HISTORY = 'WITH_USER_HISTORY',
  WITH_THUMBNAILS = 'WITH_THUMBNAILS'
}

export type ForAPIOptions = {
  ids?: number[]

  videoPlaylistId?: number

  withAccountBlockerIds?: number[]
}

@Scopes(() => ({
  [ScopeNames.WITH_IMMUTABLE_ATTRIBUTES]: {
    attributes: [ 'id', 'url', 'uuid', 'remote' ]
  },
  [ScopeNames.FOR_API]: (options: ForAPIOptions) => {
    const include: Includeable[] = [
      {
        model: VideoChannelModel.scope({
          method: [
            VideoChannelScopeNames.SUMMARY, {
              withAccount: true,
              withAccountBlockerIds: options.withAccountBlockerIds
            } as SummaryOptions
          ]
        }),
        required: true
      },
      {
        attributes: [ 'type', 'filename' ],
        model: ThumbnailModel,
        required: false
      }
    ]

    const query: FindOptions = {}

    if (options.ids) {
      query.where = {
        id: {
          [Op.in]: options.ids
        }
      }
    }

    if (options.videoPlaylistId) {
      include.push({
        model: VideoPlaylistElementModel.unscoped(),
        required: true,
        where: {
          videoPlaylistId: options.videoPlaylistId
        }
      })
    }

    query.include = include

    return query
  },
  [ScopeNames.WITH_THUMBNAILS]: {
    include: [
      {
        model: ThumbnailModel,
        required: false
      }
    ]
  },
  [ScopeNames.WITH_ACCOUNT_DETAILS]: {
    include: [
      {
        model: VideoChannelModel.unscoped(),
        required: true,
        include: [
          {
            attributes: {
              exclude: [ 'privateKey', 'publicKey' ]
            },
            model: ActorModel.unscoped(),
            required: true,
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
          },
          {
            model: AccountModel.unscoped(),
            required: true,
            include: [
              {
                model: ActorModel.unscoped(),
                attributes: {
                  exclude: [ 'privateKey', 'publicKey' ]
                },
                required: true,
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
          }
        ]
      }
    ]
  },
  [ScopeNames.WITH_TAGS]: {
    include: [ TagModel ]
  },
  [ScopeNames.WITH_BLACKLISTED]: {
    include: [
      {
        attributes: [ 'id', 'reason', 'unfederated' ],
        model: VideoBlacklistModel,
        required: false
      }
    ]
  },
  [ScopeNames.WITH_WEBTORRENT_FILES]: (withRedundancies = false) => {
    let subInclude: any[] = []

    if (withRedundancies === true) {
      subInclude = [
        {
          attributes: [ 'fileUrl' ],
          model: VideoRedundancyModel.unscoped(),
          required: false
        }
      ]
    }

    return {
      include: [
        {
          model: VideoFileModel,
          separate: true,
          required: false,
          include: subInclude
        }
      ]
    }
  },
  [ScopeNames.WITH_STREAMING_PLAYLISTS]: (withRedundancies = false) => {
    const subInclude: IncludeOptions[] = [
      {
        model: VideoFileModel,
        required: false
      }
    ]

    if (withRedundancies === true) {
      subInclude.push({
        attributes: [ 'fileUrl' ],
        model: VideoRedundancyModel.unscoped(),
        required: false
      })
    }

    return {
      include: [
        {
          model: VideoStreamingPlaylistModel.unscoped(),
          required: false,
          separate: true,
          include: subInclude
        }
      ]
    }
  },
  [ScopeNames.WITH_SCHEDULED_UPDATE]: {
    include: [
      {
        model: ScheduleVideoUpdateModel.unscoped(),
        required: false
      }
    ]
  },
  [ScopeNames.WITH_USER_HISTORY]: (userId: number) => {
    return {
      include: [
        {
          attributes: [ 'currentTime' ],
          model: UserVideoHistoryModel.unscoped(),
          required: false,
          where: {
            userId
          }
        }
      ]
    }
  }
}))
@Table({
  tableName: 'video',
  indexes: [
    buildTrigramSearchIndex('video_name_trigram', 'name'),

    { fields: [ 'createdAt' ] },
    {
      fields: [
        { name: 'publishedAt', order: 'DESC' },
        { name: 'id', order: 'ASC' }
      ]
    },
    { fields: [ 'duration' ] },
    {
      fields: [
        { name: 'views', order: 'DESC' },
        { name: 'id', order: 'ASC' }
      ]
    },
    { fields: [ 'channelId' ] },
    {
      fields: [ 'originallyPublishedAt' ],
      where: {
        originallyPublishedAt: {
          [Op.ne]: null
        }
      }
    },
    {
      fields: [ 'category' ], // We don't care videos with an unknown category
      where: {
        category: {
          [Op.ne]: null
        }
      }
    },
    {
      fields: [ 'licence' ], // We don't care videos with an unknown licence
      where: {
        licence: {
          [Op.ne]: null
        }
      }
    },
    {
      fields: [ 'language' ], // We don't care videos with an unknown language
      where: {
        language: {
          [Op.ne]: null
        }
      }
    },
    {
      fields: [ 'nsfw' ], // Most of the videos are not NSFW
      where: {
        nsfw: true
      }
    },
    {
      fields: [ 'remote' ], // Only index local videos
      where: {
        remote: false
      }
    },
    {
      fields: [ 'uuid' ],
      unique: true
    },
    {
      fields: [ 'url' ],
      unique: true
    }
  ]
})
export class VideoModel extends Model<Partial<AttributesOnly<VideoModel>>> {

  @AllowNull(false)
  @Default(DataType.UUIDV4)
  @IsUUID(4)
  @Column(DataType.UUID)
  uuid: string

  @AllowNull(false)
  @Is('VideoName', value => throwIfNotValid(value, isVideoNameValid, 'name'))
  @Column
  name: string

  @AllowNull(true)
  @Default(null)
  @Column
  category: number

  @AllowNull(true)
  @Default(null)
  @Column
  licence: number

  @AllowNull(true)
  @Default(null)
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.VIDEOS.LANGUAGE.max))
  language: string

  @AllowNull(false)
  @Is('VideoPrivacy', value => throwIfNotValid(value, isVideoPrivacyValid, 'privacy'))
  @Column
  privacy: VideoPrivacy

  @AllowNull(false)
  @Is('VideoNSFW', value => throwIfNotValid(value, isBooleanValid, 'NSFW boolean'))
  @Column
  nsfw: boolean

  @AllowNull(true)
  @Default(null)
  @Is('VideoDescription', value => throwIfNotValid(value, isVideoDescriptionValid, 'description', true))
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.VIDEOS.DESCRIPTION.max))
  description: string

  @AllowNull(true)
  @Default(null)
  @Is('VideoSupport', value => throwIfNotValid(value, isVideoSupportValid, 'support', true))
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.VIDEOS.SUPPORT.max))
  support: string

  @AllowNull(false)
  @Is('VideoDuration', value => throwIfNotValid(value, isVideoDurationValid, 'duration'))
  @Column
  duration: number

  @AllowNull(false)
  @Default(0)
  @IsInt
  @Min(0)
  @Column
  views: number

  @AllowNull(false)
  @Default(0)
  @IsInt
  @Min(0)
  @Column
  likes: number

  @AllowNull(false)
  @Default(0)
  @IsInt
  @Min(0)
  @Column
  dislikes: number

  @AllowNull(false)
  @Column
  remote: boolean

  @AllowNull(false)
  @Default(false)
  @Column
  isLive: boolean

  @AllowNull(false)
  @Is('VideoUrl', value => throwIfNotValid(value, isActivityPubUrlValid, 'url'))
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.VIDEOS.URL.max))
  url: string

  @AllowNull(false)
  @Column
  commentsEnabled: boolean

  @AllowNull(false)
  @Column
  downloadEnabled: boolean

  @AllowNull(false)
  @Column
  waitTranscoding: boolean

  @AllowNull(false)
  @Default(null)
  @Is('VideoState', value => throwIfNotValid(value, isVideoStateValid, 'state'))
  @Column
  state: VideoState

  @CreatedAt
  createdAt: Date

  @UpdatedAt
  updatedAt: Date

  @AllowNull(false)
  @Default(DataType.NOW)
  @Column
  publishedAt: Date

  @AllowNull(true)
  @Default(null)
  @Column
  originallyPublishedAt: Date

  @ForeignKey(() => VideoChannelModel)
  @Column
  channelId: number

  @BelongsTo(() => VideoChannelModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'cascade'
  })
  VideoChannel: VideoChannelModel

  @BelongsToMany(() => TagModel, {
    foreignKey: 'videoId',
    through: () => VideoTagModel,
    onDelete: 'CASCADE'
  })
  Tags: TagModel[]

  @BelongsToMany(() => TrackerModel, {
    foreignKey: 'videoId',
    through: () => VideoTrackerModel,
    onDelete: 'CASCADE'
  })
  Trackers: TrackerModel[]

  @HasMany(() => ThumbnailModel, {
    foreignKey: {
      name: 'videoId',
      allowNull: true
    },
    hooks: true,
    onDelete: 'cascade'
  })
  Thumbnails: ThumbnailModel[]

  @HasMany(() => VideoPlaylistElementModel, {
    foreignKey: {
      name: 'videoId',
      allowNull: true
    },
    onDelete: 'set null'
  })
  VideoPlaylistElements: VideoPlaylistElementModel[]

  @HasOne(() => VideoSourceModel, {
    foreignKey: {
      name: 'videoId',
      allowNull: true
    },
    onDelete: 'CASCADE'
  })
  VideoSource: VideoSourceModel

  @HasMany(() => VideoAbuseModel, {
    foreignKey: {
      name: 'videoId',
      allowNull: true
    },
    onDelete: 'set null'
  })
  VideoAbuses: VideoAbuseModel[]

  @HasMany(() => VideoFileModel, {
    foreignKey: {
      name: 'videoId',
      allowNull: true
    },
    hooks: true,
    onDelete: 'cascade'
  })
  VideoFiles: VideoFileModel[]

  @HasMany(() => VideoStreamingPlaylistModel, {
    foreignKey: {
      name: 'videoId',
      allowNull: false
    },
    hooks: true,
    onDelete: 'cascade'
  })
  VideoStreamingPlaylists: VideoStreamingPlaylistModel[]

  @HasMany(() => VideoShareModel, {
    foreignKey: {
      name: 'videoId',
      allowNull: false
    },
    onDelete: 'cascade'
  })
  VideoShares: VideoShareModel[]

  @HasMany(() => AccountVideoRateModel, {
    foreignKey: {
      name: 'videoId',
      allowNull: false
    },
    onDelete: 'cascade'
  })
  AccountVideoRates: AccountVideoRateModel[]

  @HasMany(() => VideoCommentModel, {
    foreignKey: {
      name: 'videoId',
      allowNull: false
    },
    onDelete: 'cascade',
    hooks: true
  })
  VideoComments: VideoCommentModel[]

  @HasMany(() => VideoViewModel, {
    foreignKey: {
      name: 'videoId',
      allowNull: false
    },
    onDelete: 'cascade'
  })
  VideoViews: VideoViewModel[]

  @HasMany(() => UserVideoHistoryModel, {
    foreignKey: {
      name: 'videoId',
      allowNull: false
    },
    onDelete: 'cascade'
  })
  UserVideoHistories: UserVideoHistoryModel[]

  @HasOne(() => ScheduleVideoUpdateModel, {
    foreignKey: {
      name: 'videoId',
      allowNull: false
    },
    onDelete: 'cascade'
  })
  ScheduleVideoUpdate: ScheduleVideoUpdateModel

  @HasOne(() => VideoBlacklistModel, {
    foreignKey: {
      name: 'videoId',
      allowNull: false
    },
    onDelete: 'cascade'
  })
  VideoBlacklist: VideoBlacklistModel

  @HasOne(() => VideoLiveModel, {
    foreignKey: {
      name: 'videoId',
      allowNull: false
    },
    onDelete: 'cascade'
  })
  VideoLive: VideoLiveModel

  @HasOne(() => VideoImportModel, {
    foreignKey: {
      name: 'videoId',
      allowNull: true
    },
    onDelete: 'set null'
  })
  VideoImport: VideoImportModel

  @HasMany(() => VideoCaptionModel, {
    foreignKey: {
      name: 'videoId',
      allowNull: false
    },
    onDelete: 'cascade',
    hooks: true,
    ['separate' as any]: true
  })
  VideoCaptions: VideoCaptionModel[]

  @HasOne(() => VideoJobInfoModel, {
    foreignKey: {
      name: 'videoId',
      allowNull: false
    },
    onDelete: 'cascade'
  })
  VideoJobInfo: VideoJobInfoModel

  @BeforeDestroy
  static async sendDelete (instance: MVideoAccountLight, options) {
    if (!instance.isOwned()) return undefined

    // Lazy load channels
    if (!instance.VideoChannel) {
      instance.VideoChannel = await instance.$get('VideoChannel', {
        include: [
          ActorModel,
          AccountModel
        ],
        transaction: options.transaction
      }) as MChannelAccountDefault
    }

    return sendDeleteVideo(instance, options.transaction)
  }

  @BeforeDestroy
  static async removeFiles (instance: VideoModel, options) {
    const tasks: Promise<any>[] = []

    logger.info('Removing files of video %s.', instance.url)

    if (instance.isOwned()) {
      if (!Array.isArray(instance.VideoFiles)) {
        instance.VideoFiles = await instance.$get('VideoFiles', { transaction: options.transaction })
      }

      // Remove physical files and torrents
      instance.VideoFiles.forEach(file => {
        tasks.push(instance.removeWebTorrentFile(file))
      })

      // Remove playlists file
      if (!Array.isArray(instance.VideoStreamingPlaylists)) {
        instance.VideoStreamingPlaylists = await instance.$get('VideoStreamingPlaylists', { transaction: options.transaction })
      }

      for (const p of instance.VideoStreamingPlaylists) {
        tasks.push(instance.removeStreamingPlaylistFiles(p))
      }
    }

    // Do not wait video deletion because we could be in a transaction
    Promise.all(tasks)
           .catch(err => {
             logger.error('Some errors when removing files of video %s in before destroy hook.', instance.uuid, { err })
           })

    return undefined
  }

  @BeforeDestroy
  static stopLiveIfNeeded (instance: VideoModel) {
    if (!instance.isLive) return

    logger.info('Stopping live of video %s after video deletion.', instance.uuid)

    LiveManager.Instance.stopSessionOf(instance.id, null)
  }

  @BeforeDestroy
  static invalidateCache (instance: VideoModel) {
    ModelCache.Instance.invalidateCache('video', instance.id)
  }

  @BeforeDestroy
  static async saveEssentialDataToAbuses (instance: VideoModel, options) {
    const tasks: Promise<any>[] = []

    if (!Array.isArray(instance.VideoAbuses)) {
      instance.VideoAbuses = await instance.$get('VideoAbuses', { transaction: options.transaction })

      if (instance.VideoAbuses.length === 0) return undefined
    }

    logger.info('Saving video abuses details of video %s.', instance.url)

    if (!instance.Trackers) instance.Trackers = await instance.$get('Trackers', { transaction: options.transaction })
    const details = instance.toFormattedDetailsJSON()

    for (const abuse of instance.VideoAbuses) {
      abuse.deletedVideo = details
      tasks.push(abuse.save({ transaction: options.transaction }))
    }

    await Promise.all(tasks)
  }

  static listLocalIds (): Promise<number[]> {
    const query = {
      attributes: [ 'id' ],
      raw: true,
      where: {
        remote: false
      }
    }

    return VideoModel.findAll(query)
      .then(rows => rows.map(r => r.id))
  }

  static listAllAndSharedByActorForOutbox (actorId: number, start: number, count: number) {
    function getRawQuery (select: string) {
      const queryVideo = 'SELECT ' + select + ' FROM "video" AS "Video" ' +
        'INNER JOIN "videoChannel" AS "VideoChannel" ON "VideoChannel"."id" = "Video"."channelId" ' +
        'INNER JOIN "account" AS "Account" ON "Account"."id" = "VideoChannel"."accountId" ' +
        'WHERE "Account"."actorId" = ' + actorId
      const queryVideoShare = 'SELECT ' + select + ' FROM "videoShare" AS "VideoShare" ' +
        'INNER JOIN "video" AS "Video" ON "Video"."id" = "VideoShare"."videoId" ' +
        'WHERE "VideoShare"."actorId" = ' + actorId

      return `(${queryVideo}) UNION (${queryVideoShare})`
    }

    const rawQuery = getRawQuery('"Video"."id"')
    const rawCountQuery = getRawQuery('COUNT("Video"."id") as "total"')

    const query = {
      distinct: true,
      offset: start,
      limit: count,
      order: getVideoSort('-createdAt', [ 'Tags', 'name', 'ASC' ]),
      where: {
        id: {
          [Op.in]: Sequelize.literal('(' + rawQuery + ')')
        },
        [Op.or]: getPrivaciesForFederation()
      },
      include: [
        {
          attributes: [ 'filename', 'language', 'fileUrl' ],
          model: VideoCaptionModel.unscoped(),
          required: false
        },
        {
          attributes: [ 'id', 'url' ],
          model: VideoShareModel.unscoped(),
          required: false,
          // We only want videos shared by this actor
          where: {
            [Op.and]: [
              {
                id: {
                  [Op.not]: null
                }
              },
              {
                actorId
              }
            ]
          },
          include: [
            {
              attributes: [ 'id', 'url' ],
              model: ActorModel.unscoped()
            }
          ]
        },
        {
          model: VideoChannelModel.unscoped(),
          required: true,
          include: [
            {
              attributes: [ 'name' ],
              model: AccountModel.unscoped(),
              required: true,
              include: [
                {
                  attributes: [ 'id', 'url', 'followersUrl' ],
                  model: ActorModel.unscoped(),
                  required: true
                }
              ]
            },
            {
              attributes: [ 'id', 'url', 'followersUrl' ],
              model: ActorModel.unscoped(),
              required: true
            }
          ]
        },
        {
          model: VideoStreamingPlaylistModel.unscoped(),
          required: false,
          include: [
            {
              model: VideoFileModel,
              required: false
            }
          ]
        },
        VideoLiveModel.unscoped(),
        VideoFileModel,
        TagModel
      ]
    }

    return Bluebird.all([
      VideoModel.scope(ScopeNames.WITH_THUMBNAILS).findAll(query),
      VideoModel.sequelize.query<{ total: string }>(rawCountQuery, { type: QueryTypes.SELECT })
    ]).then(([ rows, totals ]) => {
      // totals: totalVideos + totalVideoShares
      let totalVideos = 0
      let totalVideoShares = 0
      if (totals[0]) totalVideos = parseInt(totals[0].total, 10)
      if (totals[1]) totalVideoShares = parseInt(totals[1].total, 10)

      const total = totalVideos + totalVideoShares
      return {
        data: rows,
        total
      }
    })
  }

  static async listPublishedLiveUUIDs () {
    const options = {
      attributes: [ 'uuid' ],
      where: {
        isLive: true,
        remote: false,
        state: VideoState.PUBLISHED
      }
    }

    const result = await VideoModel.findAll(options)

    return result.map(v => v.uuid)
  }

  static listUserVideosForApi (options: {
    accountId: number
    start: number
    count: number
    sort: string

    channelId?: number
    isLive?: boolean
    search?: string
  }) {
    const { accountId, channelId, start, count, sort, search, isLive } = options

    function buildBaseQuery (forCount: boolean): FindOptions {
      const where: WhereOptions = {}

      if (search) {
        where.name = {
          [Op.iLike]: '%' + search + '%'
        }
      }

      if (exists(isLive)) {
        where.isLive = isLive
      }

      const channelWhere = channelId
        ? { id: channelId }
        : {}

      const baseQuery = {
        offset: start,
        limit: count,
        where,
        order: getVideoSort(sort),
        include: [
          {
            model: forCount
              ? VideoChannelModel.unscoped()
              : VideoChannelModel,
            required: true,
            where: channelWhere,
            include: [
              {
                model: forCount
                  ? AccountModel.unscoped()
                  : AccountModel,
                where: {
                  id: accountId
                },
                required: true
              }
            ]
          }
        ]
      }

      return baseQuery
    }

    const countQuery = buildBaseQuery(true)
    const findQuery = buildBaseQuery(false)

    const findScopes: (string | ScopeOptions)[] = [
      ScopeNames.WITH_SCHEDULED_UPDATE,
      ScopeNames.WITH_BLACKLISTED,
      ScopeNames.WITH_THUMBNAILS
    ]

    return Promise.all([
      VideoModel.count(countQuery),
      VideoModel.scope(findScopes).findAll<MVideoForUser>(findQuery)
    ]).then(([ count, rows ]) => {
      return {
        data: rows,
        total: count
      }
    })
  }

  static async listForApi (options: {
    start: number
    count: number
    sort: string

    nsfw: boolean
    isLive?: boolean
    isLocal?: boolean
    include?: VideoInclude

    hasFiles?: boolean // default false
    hasWebtorrentFiles?: boolean
    hasHLSFiles?: boolean

    categoryOneOf?: number[]
    licenceOneOf?: number[]
    languageOneOf?: string[]
    tagsOneOf?: string[]
    tagsAllOf?: string[]
    privacyOneOf?: VideoPrivacy[]

    accountId?: number
    videoChannelId?: number

    displayOnlyForFollower: DisplayOnlyForFollowerOptions | null

    videoPlaylistId?: number

    trendingDays?: number

    user?: MUserAccountId
    historyOfUser?: MUserId

    countVideos?: boolean

    search?: string
  }) {
    VideoModel.throwIfPrivateIncludeWithoutUser(options.include, options.user)
    VideoModel.throwIfPrivacyOneOfWithoutUser(options.privacyOneOf, options.user)

    const trendingDays = options.sort.endsWith('trending')
      ? CONFIG.TRENDING.VIDEOS.INTERVAL_DAYS
      : undefined

    let trendingAlgorithm: string
    if (options.sort.endsWith('hot')) trendingAlgorithm = 'hot'
    if (options.sort.endsWith('best')) trendingAlgorithm = 'best'

    const serverActor = await getServerActor()

    const queryOptions = {
      ...pick(options, [
        'start',
        'count',
        'sort',
        'nsfw',
        'isLive',
        'categoryOneOf',
        'licenceOneOf',
        'languageOneOf',
        'tagsOneOf',
        'tagsAllOf',
        'privacyOneOf',
        'isLocal',
        'include',
        'displayOnlyForFollower',
        'hasFiles',
        'accountId',
        'videoChannelId',
        'videoPlaylistId',
        'user',
        'historyOfUser',
        'hasHLSFiles',
        'hasWebtorrentFiles',
        'search'
      ]),

      serverAccountIdForBlock: serverActor.Account.id,
      trendingDays,
      trendingAlgorithm
    }

    return VideoModel.getAvailableForApi(queryOptions, options.countVideos)
  }

  static async searchAndPopulateAccountAndServer (options: {
    start: number
    count: number
    sort: string

    nsfw?: boolean
    isLive?: boolean
    isLocal?: boolean
    include?: VideoInclude

    categoryOneOf?: number[]
    licenceOneOf?: number[]
    languageOneOf?: string[]
    tagsOneOf?: string[]
    tagsAllOf?: string[]
    privacyOneOf?: VideoPrivacy[]

    displayOnlyForFollower: DisplayOnlyForFollowerOptions | null

    user?: MUserAccountId

    hasWebtorrentFiles?: boolean
    hasHLSFiles?: boolean

    search?: string

    host?: string
    startDate?: string // ISO 8601
    endDate?: string // ISO 8601
    originallyPublishedStartDate?: string
    originallyPublishedEndDate?: string

    durationMin?: number // seconds
    durationMax?: number // seconds
    uuids?: string[]
  }) {
    VideoModel.throwIfPrivateIncludeWithoutUser(options.include, options.user)
    VideoModel.throwIfPrivacyOneOfWithoutUser(options.privacyOneOf, options.user)

    const serverActor = await getServerActor()

    const queryOptions = {
      ...pick(options, [
        'include',
        'nsfw',
        'isLive',
        'categoryOneOf',
        'licenceOneOf',
        'languageOneOf',
        'tagsOneOf',
        'tagsAllOf',
        'privacyOneOf',
        'user',
        'isLocal',
        'host',
        'start',
        'count',
        'sort',
        'startDate',
        'endDate',
        'originallyPublishedStartDate',
        'originallyPublishedEndDate',
        'durationMin',
        'durationMax',
        'hasHLSFiles',
        'hasWebtorrentFiles',
        'uuids',
        'search',
        'displayOnlyForFollower'
      ]),
      serverAccountIdForBlock: serverActor.Account.id
    }

    return VideoModel.getAvailableForApi(queryOptions)
  }

  static countLives (options: {
    remote: boolean
    mode: 'published' | 'not-ended'
  }) {
    const query = {
      where: {
        remote: options.remote,
        isLive: true,
        state: options.mode === 'not-ended'
          ? { [Op.ne]: VideoState.LIVE_ENDED }
          : { [Op.eq]: VideoState.PUBLISHED }
      }
    }

    return VideoModel.count(query)
  }

  static countVideosUploadedByUserSince (userId: number, since: Date) {
    const options = {
      include: [
        {
          model: VideoChannelModel.unscoped(),
          required: true,
          include: [
            {
              model: AccountModel.unscoped(),
              required: true,
              include: [
                {
                  model: UserModel.unscoped(),
                  required: true,
                  where: {
                    id: userId
                  }
                }
              ]
            }
          ]
        }
      ],
      where: {
        createdAt: {
          [Op.gte]: since
        }
      }
    }

    return VideoModel.unscoped().count(options)
  }

  static countLivesOfAccount (accountId: number) {
    const options = {
      where: {
        remote: false,
        isLive: true,
        state: {
          [Op.ne]: VideoState.LIVE_ENDED
        }
      },
      include: [
        {
          required: true,
          model: VideoChannelModel.unscoped(),
          where: {
            accountId
          }
        }
      ]
    }

    return VideoModel.count(options)
  }

  static load (id: number | string, transaction?: Transaction): Promise<MVideoThumbnail> {
    const queryBuilder = new VideoModelGetQueryBuilder(VideoModel.sequelize)

    return queryBuilder.queryVideo({ id, transaction, type: 'thumbnails' })
  }

  static loadWithBlacklist (id: number | string, transaction?: Transaction): Promise<MVideoThumbnailBlacklist> {
    const queryBuilder = new VideoModelGetQueryBuilder(VideoModel.sequelize)

    return queryBuilder.queryVideo({ id, transaction, type: 'thumbnails-blacklist' })
  }

  static loadImmutableAttributes (id: number | string, t?: Transaction): Promise<MVideoImmutable> {
    const fun = () => {
      const query = {
        where: buildWhereIdOrUUID(id),
        transaction: t
      }

      return VideoModel.scope(ScopeNames.WITH_IMMUTABLE_ATTRIBUTES).findOne(query)
    }

    return ModelCache.Instance.doCache({
      cacheType: 'load-video-immutable-id',
      key: '' + id,
      deleteKey: 'video',
      fun
    })
  }

  static loadByUrlImmutableAttributes (url: string, transaction?: Transaction): Promise<MVideoImmutable> {
    const fun = () => {
      const query: FindOptions = {
        where: {
          url
        },
        transaction
      }

      return VideoModel.scope(ScopeNames.WITH_IMMUTABLE_ATTRIBUTES).findOne(query)
    }

    return ModelCache.Instance.doCache({
      cacheType: 'load-video-immutable-url',
      key: url,
      deleteKey: 'video',
      fun
    })
  }

  static loadOnlyId (id: number | string, transaction?: Transaction): Promise<MVideoId> {
    const queryBuilder = new VideoModelGetQueryBuilder(VideoModel.sequelize)

    return queryBuilder.queryVideo({ id, transaction, type: 'id' })
  }

  static loadWithFiles (id: number | string, transaction?: Transaction, logging?: boolean): Promise<MVideoWithAllFiles> {
    const queryBuilder = new VideoModelGetQueryBuilder(VideoModel.sequelize)

    return queryBuilder.queryVideo({ id, transaction, type: 'all-files', logging })
  }

  static loadByUrl (url: string, transaction?: Transaction): Promise<MVideoThumbnail> {
    const queryBuilder = new VideoModelGetQueryBuilder(VideoModel.sequelize)

    return queryBuilder.queryVideo({ url, transaction, type: 'thumbnails' })
  }

  static loadByUrlAndPopulateAccount (url: string, transaction?: Transaction): Promise<MVideoAccountLightBlacklistAllFiles> {
    const queryBuilder = new VideoModelGetQueryBuilder(VideoModel.sequelize)

    return queryBuilder.queryVideo({ url, transaction, type: 'account-blacklist-files' })
  }

  static loadFull (id: number | string, t?: Transaction, userId?: number): Promise<MVideoFullLight> {
    const queryBuilder = new VideoModelGetQueryBuilder(VideoModel.sequelize)

    return queryBuilder.queryVideo({ id, transaction: t, type: 'full', userId })
  }

  static loadForGetAPI (parameters: {
    id: number | string
    transaction?: Transaction
    userId?: number
  }): Promise<MVideoDetails> {
    const { id, transaction, userId } = parameters
    const queryBuilder = new VideoModelGetQueryBuilder(VideoModel.sequelize)

    return queryBuilder.queryVideo({ id, transaction, type: 'api', userId })
  }

  static async getStats () {
    const serverActor = await getServerActor()

    let totalLocalVideoViews = await VideoModel.sum('views', {
      where: {
        remote: false
      }
    })

    // Sequelize could return null...
    if (!totalLocalVideoViews) totalLocalVideoViews = 0

    const baseOptions = {
      start: 0,
      count: 0,
      sort: '-publishedAt',
      nsfw: null,
      displayOnlyForFollower: {
        actorId: serverActor.id,
        orLocalVideos: true
      }
    }

    const { total: totalLocalVideos } = await VideoModel.listForApi({
      ...baseOptions,

      isLocal: true
    })

    const { total: totalVideos } = await VideoModel.listForApi(baseOptions)

    return {
      totalLocalVideos,
      totalLocalVideoViews,
      totalVideos
    }
  }

  static incrementViews (id: number, views: number) {
    return VideoModel.increment('views', {
      by: views,
      where: {
        id
      }
    })
  }

  static updateRatesOf (videoId: number, type: VideoRateType, count: number, t: Transaction) {
    const field = type === 'like'
      ? 'likes'
      : 'dislikes'

    const rawQuery = `UPDATE "video" SET "${field}" = :count WHERE "video"."id" = :videoId`

    return AccountVideoRateModel.sequelize.query(rawQuery, {
      transaction: t,
      replacements: { videoId, rateType: type, count },
      type: QueryTypes.UPDATE
    })
  }

  static syncLocalRates (videoId: number, type: VideoRateType, t: Transaction) {
    const field = type === 'like'
      ? 'likes'
      : 'dislikes'

    const rawQuery = `UPDATE "video" SET "${field}" = ` +
      '(' +
        'SELECT COUNT(id) FROM "accountVideoRate" WHERE "accountVideoRate"."videoId" = "video"."id" AND type = :rateType' +
      ') ' +
      'WHERE "video"."id" = :videoId'

    return AccountVideoRateModel.sequelize.query(rawQuery, {
      transaction: t,
      replacements: { videoId, rateType: type },
      type: QueryTypes.UPDATE
    })
  }

  static checkVideoHasInstanceFollow (videoId: number, followerActorId: number) {
    // Instances only share videos
    const query = 'SELECT 1 FROM "videoShare" ' +
      'INNER JOIN "actorFollow" ON "actorFollow"."targetActorId" = "videoShare"."actorId" ' +
      'WHERE "actorFollow"."actorId" = $followerActorId AND "actorFollow"."state" = \'accepted\' AND "videoShare"."videoId" = $videoId ' +
      'LIMIT 1'

    const options = {
      type: QueryTypes.SELECT as QueryTypes.SELECT,
      bind: { followerActorId, videoId },
      raw: true
    }

    return VideoModel.sequelize.query(query, options)
                     .then(results => results.length === 1)
  }

  static bulkUpdateSupportField (ofChannel: MChannel, t: Transaction) {
    const options = {
      where: {
        channelId: ofChannel.id
      },
      transaction: t
    }

    return VideoModel.update({ support: ofChannel.support }, options)
  }

  static getAllIdsFromChannel (videoChannel: MChannelId): Promise<number[]> {
    const query = {
      attributes: [ 'id' ],
      where: {
        channelId: videoChannel.id
      }
    }

    return VideoModel.findAll(query)
                     .then(videos => videos.map(v => v.id))
  }

  // threshold corresponds to how many video the field should have to be returned
  static async getRandomFieldSamples (field: 'category' | 'channelId', threshold: number, count: number) {
    const serverActor = await getServerActor()

    const queryOptions: BuildVideosListQueryOptions = {
      attributes: [ `"${field}"` ],
      group: `GROUP BY "${field}"`,
      having: `HAVING COUNT("${field}") >= ${threshold}`,
      start: 0,
      sort: 'random',
      count,
      serverAccountIdForBlock: serverActor.Account.id,
      displayOnlyForFollower: {
        actorId: serverActor.id,
        orLocalVideos: true
      }
    }

    const queryBuilder = new VideosIdListQueryBuilder(VideoModel.sequelize)

    return queryBuilder.queryVideoIds(queryOptions)
      .then(rows => rows.map(r => r[field]))
  }

  static buildTrendingQuery (trendingDays: number) {
    return {
      attributes: [],
      subQuery: false,
      model: VideoViewModel,
      required: false,
      where: {
        startDate: {
          // FIXME: ts error
          [Op.gte as any]: new Date(new Date().getTime() - (24 * 3600 * 1000) * trendingDays)
        }
      }
    }
  }

  private static async getAvailableForApi (
    options: BuildVideosListQueryOptions,
    countVideos = true
  ): Promise<ResultList<VideoModel>> {
    const span = tracer.startSpan('peertube.VideoModel.getAvailableForApi')

    function getCount () {
      if (countVideos !== true) return Promise.resolve(undefined)

      const countOptions = Object.assign({}, options, { isCount: true })
      const queryBuilder = new VideosIdListQueryBuilder(VideoModel.sequelize)

      return queryBuilder.countVideoIds(countOptions)
    }

    function getModels () {
      if (options.count === 0) return Promise.resolve([])

      const queryBuilder = new VideosModelListQueryBuilder(VideoModel.sequelize)

      return queryBuilder.queryVideos(options)
    }

    const [ count, rows ] = await Promise.all([ getCount(), getModels() ])

    span.end()

    return {
      data: rows,
      total: count
    }
  }

  private static throwIfPrivateIncludeWithoutUser (include: VideoInclude, user: MUserAccountId) {
    if (VideoModel.isPrivateInclude(include) && !user?.hasRight(UserRight.SEE_ALL_VIDEOS)) {
      throw new Error('Try to filter all-local but user cannot see all videos')
    }
  }

  private static throwIfPrivacyOneOfWithoutUser (privacyOneOf: VideoPrivacy[], user: MUserAccountId) {
    if (privacyOneOf && !user?.hasRight(UserRight.SEE_ALL_VIDEOS)) {
      throw new Error('Try to choose video privacies but user cannot see all videos')
    }
  }

  private static isPrivateInclude (include: VideoInclude) {
    return include & VideoInclude.BLACKLISTED ||
           include & VideoInclude.BLOCKED_OWNER ||
           include & VideoInclude.NOT_PUBLISHED_STATE
  }

  isBlacklisted () {
    return !!this.VideoBlacklist
  }

  isBlocked () {
    return this.VideoChannel.Account.Actor.Server?.isBlocked() || this.VideoChannel.Account.isBlocked()
  }

  getQualityFileBy<T extends MVideoWithFile> (this: T, fun: (files: MVideoFile[], it: (file: MVideoFile) => number) => MVideoFile) {
    // We first transcode to WebTorrent format, so try this array first
    if (Array.isArray(this.VideoFiles) && this.VideoFiles.length !== 0) {
      const file = fun(this.VideoFiles, file => file.resolution)

      return Object.assign(file, { Video: this })
    }

    // No webtorrent files, try with streaming playlist files
    if (Array.isArray(this.VideoStreamingPlaylists) && this.VideoStreamingPlaylists.length !== 0) {
      const streamingPlaylistWithVideo = Object.assign(this.VideoStreamingPlaylists[0], { Video: this })

      const file = fun(streamingPlaylistWithVideo.VideoFiles, file => file.resolution)
      return Object.assign(file, { VideoStreamingPlaylist: streamingPlaylistWithVideo })
    }

    return undefined
  }

  getMaxQualityFile<T extends MVideoWithFile> (this: T): MVideoFileVideo | MVideoFileStreamingPlaylistVideo {
    return this.getQualityFileBy(maxBy)
  }

  getMinQualityFile<T extends MVideoWithFile> (this: T): MVideoFileVideo | MVideoFileStreamingPlaylistVideo {
    return this.getQualityFileBy(minBy)
  }

  getWebTorrentFile<T extends MVideoWithFile> (this: T, resolution: number): MVideoFileVideo {
    if (Array.isArray(this.VideoFiles) === false) return undefined

    const file = this.VideoFiles.find(f => f.resolution === resolution)
    if (!file) return undefined

    return Object.assign(file, { Video: this })
  }

  hasWebTorrentFiles () {
    return Array.isArray(this.VideoFiles) === true && this.VideoFiles.length !== 0
  }

  async addAndSaveThumbnail (thumbnail: MThumbnail, transaction?: Transaction) {
    thumbnail.videoId = this.id

    const savedThumbnail = await thumbnail.save({ transaction })

    if (Array.isArray(this.Thumbnails) === false) this.Thumbnails = []

    this.Thumbnails = this.Thumbnails.filter(t => t.id !== savedThumbnail.id)
    this.Thumbnails.push(savedThumbnail)
  }

  getMiniature () {
    if (Array.isArray(this.Thumbnails) === false) return undefined

    return this.Thumbnails.find(t => t.type === ThumbnailType.MINIATURE)
  }

  hasPreview () {
    return !!this.getPreview()
  }

  getPreview () {
    if (Array.isArray(this.Thumbnails) === false) return undefined

    return this.Thumbnails.find(t => t.type === ThumbnailType.PREVIEW)
  }

  isOwned () {
    return this.remote === false
  }

  getWatchStaticPath () {
    return buildVideoWatchPath({ shortUUID: uuidToShort(this.uuid) })
  }

  getEmbedStaticPath () {
    return buildVideoEmbedPath(this)
  }

  getMiniatureStaticPath () {
    const thumbnail = this.getMiniature()
    if (!thumbnail) return null

    return join(STATIC_PATHS.THUMBNAILS, thumbnail.filename)
  }

  getPreviewStaticPath () {
    const preview = this.getPreview()
    if (!preview) return null

    // We use a local cache, so specify our cache endpoint instead of potential remote URL
    return join(LAZY_STATIC_PATHS.PREVIEWS, preview.filename)
  }

  toFormattedJSON (this: MVideoFormattable, options?: VideoFormattingJSONOptions): Video {
    return videoModelToFormattedJSON(this, options)
  }

  toFormattedDetailsJSON (this: MVideoFormattableDetails): VideoDetails {
    return videoModelToFormattedDetailsJSON(this)
  }

  getFormattedVideoFilesJSON (includeMagnet = true): VideoFile[] {
    let files: VideoFile[] = []

    if (Array.isArray(this.VideoFiles)) {
      const result = videoFilesModelToFormattedJSON(this, this.VideoFiles, includeMagnet)
      files = files.concat(result)
    }

    for (const p of (this.VideoStreamingPlaylists || [])) {
      const result = videoFilesModelToFormattedJSON(this, p.VideoFiles, includeMagnet)
      files = files.concat(result)
    }

    return files
  }

  toActivityPubObject (this: MVideoAP): VideoObject {
    return videoModelToActivityPubObject(this)
  }

  getTruncatedDescription () {
    if (!this.description) return null

    const maxLength = CONSTRAINTS_FIELDS.VIDEOS.TRUNCATED_DESCRIPTION.max
    return peertubeTruncate(this.description, { length: maxLength })
  }

  getAllFiles () {
    let files: MVideoFile[] = []

    if (Array.isArray(this.VideoFiles)) {
      files = files.concat(this.VideoFiles)
    }

    if (Array.isArray(this.VideoStreamingPlaylists)) {
      for (const p of this.VideoStreamingPlaylists) {
        if (Array.isArray(p.VideoFiles)) {
          files = files.concat(p.VideoFiles)
        }
      }
    }

    return files
  }

  probeMaxQualityFile () {
    const file = this.getMaxQualityFile()
    const videoOrPlaylist = file.getVideoOrStreamingPlaylist()

    return VideoPathManager.Instance.makeAvailableVideoFile(file.withVideoOrPlaylist(videoOrPlaylist), async originalFilePath => {
      const probe = await ffprobePromise(originalFilePath)

      const { audioStream } = await getAudioStream(originalFilePath, probe)

      return {
        audioStream,

        ...await getVideoStreamDimensionsInfo(originalFilePath, probe)
      }
    })
  }

  getDescriptionAPIPath () {
    return `/api/${API_VERSION}/videos/${this.uuid}/description`
  }

  getHLSPlaylist (): MStreamingPlaylistFilesVideo {
    if (!this.VideoStreamingPlaylists) return undefined

    const playlist = this.VideoStreamingPlaylists.find(p => p.type === VideoStreamingPlaylistType.HLS)
    if (!playlist) return undefined

    playlist.Video = this

    return playlist
  }

  setHLSPlaylist (playlist: MStreamingPlaylist) {
    const toAdd = [ playlist ] as [ VideoStreamingPlaylistModel ]

    if (Array.isArray(this.VideoStreamingPlaylists) === false || this.VideoStreamingPlaylists.length === 0) {
      this.VideoStreamingPlaylists = toAdd
      return
    }

    this.VideoStreamingPlaylists = this.VideoStreamingPlaylists
                                       .filter(s => s.type !== VideoStreamingPlaylistType.HLS)
                                       .concat(toAdd)
  }

  removeWebTorrentFile (videoFile: MVideoFile, isRedundancy = false) {
    const filePath = isRedundancy
      ? VideoPathManager.Instance.getFSRedundancyVideoFilePath(this, videoFile)
      : VideoPathManager.Instance.getFSVideoFileOutputPath(this, videoFile)

    const promises: Promise<any>[] = [ remove(filePath) ]
    if (!isRedundancy) promises.push(videoFile.removeTorrent())

    if (videoFile.storage === VideoStorage.OBJECT_STORAGE) {
      promises.push(removeWebTorrentObjectStorage(videoFile))
    }

    return Promise.all(promises)
  }

  async removeStreamingPlaylistFiles (streamingPlaylist: MStreamingPlaylist, isRedundancy = false) {
    const directoryPath = isRedundancy
      ? getHLSRedundancyDirectory(this)
      : getHLSDirectory(this)

    await remove(directoryPath)

    if (isRedundancy !== true) {
      const streamingPlaylistWithFiles = streamingPlaylist as MStreamingPlaylistFilesVideo
      streamingPlaylistWithFiles.Video = this

      if (!Array.isArray(streamingPlaylistWithFiles.VideoFiles)) {
        streamingPlaylistWithFiles.VideoFiles = await streamingPlaylistWithFiles.$get('VideoFiles')
      }

      // Remove physical files and torrents
      await Promise.all(
        streamingPlaylistWithFiles.VideoFiles.map(file => file.removeTorrent())
      )

      if (streamingPlaylist.storage === VideoStorage.OBJECT_STORAGE) {
        await removeHLSObjectStorage(streamingPlaylist.withVideo(this))
      }
    }
  }

  async removeStreamingPlaylistVideoFile (streamingPlaylist: MStreamingPlaylist, videoFile: MVideoFile) {
    const filePath = VideoPathManager.Instance.getFSHLSOutputPath(this, videoFile.filename)
    await videoFile.removeTorrent()
    await remove(filePath)

    const resolutionFilename = getHlsResolutionPlaylistFilename(videoFile.filename)
    await remove(VideoPathManager.Instance.getFSHLSOutputPath(this, resolutionFilename))

    if (videoFile.storage === VideoStorage.OBJECT_STORAGE) {
      await removeHLSFileObjectStorage(streamingPlaylist.withVideo(this), videoFile.filename)
      await removeHLSFileObjectStorage(streamingPlaylist.withVideo(this), resolutionFilename)
    }
  }

  async removeStreamingPlaylistFile (streamingPlaylist: MStreamingPlaylist, filename: string) {
    const filePath = VideoPathManager.Instance.getFSHLSOutputPath(this, filename)
    await remove(filePath)

    if (streamingPlaylist.storage === VideoStorage.OBJECT_STORAGE) {
      await removeHLSFileObjectStorage(streamingPlaylist.withVideo(this), filename)
    }
  }

  isOutdated () {
    if (this.isOwned()) return false

    return isOutdated(this, ACTIVITY_PUB.VIDEO_REFRESH_INTERVAL)
  }

  hasPrivacyForFederation () {
    return isPrivacyForFederation(this.privacy)
  }

  hasStateForFederation () {
    return isStateForFederation(this.state)
  }

  isNewVideo (newPrivacy: VideoPrivacy) {
    return this.hasPrivacyForFederation() === false && isPrivacyForFederation(newPrivacy) === true
  }

  setAsRefreshed (transaction?: Transaction) {
    return setAsUpdated('video', this.id, transaction)
  }

  requiresAuth () {
    return this.privacy === VideoPrivacy.PRIVATE || this.privacy === VideoPrivacy.INTERNAL || !!this.VideoBlacklist
  }

  setPrivacy (newPrivacy: VideoPrivacy) {
    if (this.privacy === VideoPrivacy.PRIVATE && newPrivacy !== VideoPrivacy.PRIVATE) {
      this.publishedAt = new Date()
    }

    this.privacy = newPrivacy
  }

  isConfidential () {
    return this.privacy === VideoPrivacy.PRIVATE ||
      this.privacy === VideoPrivacy.UNLISTED ||
      this.privacy === VideoPrivacy.INTERNAL
  }

  async setNewState (newState: VideoState, isNewVideo: boolean, transaction: Transaction) {
    if (this.state === newState) throw new Error('Cannot use same state ' + newState)

    this.state = newState

    if (this.state === VideoState.PUBLISHED && isNewVideo) {
      this.publishedAt = new Date()
    }

    await this.save({ transaction })
  }

  getBandwidthBits (this: MVideo, videoFile: MVideoFile) {
    return Math.ceil((videoFile.size * 8) / this.duration)
  }

  getTrackerUrls () {
    if (this.isOwned()) {
      return [
        WEBSERVER.URL + '/tracker/announce',
        WEBSERVER.WS + '://' + WEBSERVER.HOSTNAME + ':' + WEBSERVER.PORT + '/tracker/socket'
      ]
    }

    return this.Trackers.map(t => t.url)
  }
}
