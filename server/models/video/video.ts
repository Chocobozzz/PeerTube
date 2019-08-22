import * as Bluebird from 'bluebird'
import { maxBy } from 'lodash'
import * as magnetUtil from 'magnet-uri'
import * as parseTorrent from 'parse-torrent'
import { join } from 'path'
import {
  CountOptions,
  FindOptions,
  IncludeOptions,
  ModelIndexesOptions,
  Op,
  QueryTypes,
  ScopeOptions,
  Sequelize,
  Transaction,
  WhereOptions
} from 'sequelize'
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
import { UserRight, VideoPrivacy, VideoState } from '../../../shared'
import { VideoTorrentObject } from '../../../shared/models/activitypub/objects'
import { Video, VideoDetails, VideoFile } from '../../../shared/models/videos'
import { VideoFilter } from '../../../shared/models/videos/video-query.type'
import { peertubeTruncate } from '../../helpers/core-utils'
import { isActivityPubUrlValid } from '../../helpers/custom-validators/activitypub/misc'
import { isArray, isBooleanValid } from '../../helpers/custom-validators/misc'
import {
  isVideoCategoryValid,
  isVideoDescriptionValid,
  isVideoDurationValid,
  isVideoLanguageValid,
  isVideoLicenceValid,
  isVideoNameValid,
  isVideoPrivacyValid,
  isVideoStateValid,
  isVideoSupportValid
} from '../../helpers/custom-validators/videos'
import { getVideoFileResolution } from '../../helpers/ffmpeg-utils'
import { logger } from '../../helpers/logger'
import { getServerActor } from '../../helpers/utils'
import {
  ACTIVITY_PUB,
  API_VERSION,
  CONSTRAINTS_FIELDS,
  HLS_REDUNDANCY_DIRECTORY,
  HLS_STREAMING_PLAYLIST_DIRECTORY,
  LAZY_STATIC_PATHS,
  REMOTE_SCHEME,
  STATIC_DOWNLOAD_PATHS,
  STATIC_PATHS,
  VIDEO_CATEGORIES,
  VIDEO_LANGUAGES,
  VIDEO_LICENCES,
  VIDEO_PRIVACIES,
  VIDEO_STATES,
  WEBSERVER
} from '../../initializers/constants'
import { sendDeleteVideo } from '../../lib/activitypub/send'
import { AccountModel } from '../account/account'
import { AccountVideoRateModel } from '../account/account-video-rate'
import { ActorModel } from '../activitypub/actor'
import { AvatarModel } from '../avatar/avatar'
import { ServerModel } from '../server/server'
import {
  buildBlockedAccountSQL,
  buildTrigramSearchIndex,
  buildWhereIdOrUUID,
  createSafeIn,
  createSimilarityAttribute,
  getVideoSort,
  isOutdated,
  throwIfNotValid
} from '../utils'
import { TagModel } from './tag'
import { VideoAbuseModel } from './video-abuse'
import { ScopeNames as VideoChannelScopeNames, SummaryOptions, VideoChannelModel } from './video-channel'
import { VideoCommentModel } from './video-comment'
import { VideoFileModel } from './video-file'
import { VideoShareModel } from './video-share'
import { VideoTagModel } from './video-tag'
import { ScheduleVideoUpdateModel } from './schedule-video-update'
import { VideoCaptionModel } from './video-caption'
import { VideoBlacklistModel } from './video-blacklist'
import { remove, writeFile } from 'fs-extra'
import { VideoViewModel } from './video-views'
import { VideoRedundancyModel } from '../redundancy/video-redundancy'
import {
  videoFilesModelToFormattedJSON,
  VideoFormattingJSONOptions,
  videoModelToActivityPubObject,
  videoModelToFormattedDetailsJSON,
  videoModelToFormattedJSON
} from './video-format-utils'
import { UserVideoHistoryModel } from '../account/user-video-history'
import { VideoImportModel } from './video-import'
import { VideoStreamingPlaylistModel } from './video-streaming-playlist'
import { VideoPlaylistElementModel } from './video-playlist-element'
import { CONFIG } from '../../initializers/config'
import { ThumbnailModel } from './thumbnail'
import { ThumbnailType } from '../../../shared/models/videos/thumbnail.type'
import { createTorrentPromise } from '../../helpers/webtorrent'
import { VideoStreamingPlaylistType } from '../../../shared/models/videos/video-streaming-playlist.type'
import {
  MChannel,
  MChannelAccountDefault,
  MChannelId,
  MUserAccountId,
  MUserId,
  MVideoAccountLight,
  MVideoAccountLightBlacklistAllFiles,
  MVideoAP,
  MVideoDetails,
  MVideoFormattable,
  MVideoFormattableDetails,
  MVideoForUser,
  MVideoFullLight,
  MVideoIdThumbnail,
  MVideoThumbnail,
  MVideoThumbnailBlacklist,
  MVideoWithAllFiles,
  MVideoWithFile,
  MVideoWithRights
} from '../../typings/models'
import { MVideoFile, MVideoFileRedundanciesOpt } from '../../typings/models/video/video-file'
import { MThumbnail } from '../../typings/models/video/thumbnail'

// FIXME: Define indexes here because there is an issue with TS and Sequelize.literal when called directly in the annotation
const indexes: (ModelIndexesOptions & { where?: WhereOptions })[] = [
  buildTrigramSearchIndex('video_name_trigram', 'name'),

  { fields: [ 'createdAt' ] },
  { fields: [ 'publishedAt' ] },
  { fields: [ 'duration' ] },
  { fields: [ 'views' ] },
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

export enum ScopeNames {
  AVAILABLE_FOR_LIST_IDS = 'AVAILABLE_FOR_LIST_IDS',
  FOR_API = 'FOR_API',
  WITH_ACCOUNT_DETAILS = 'WITH_ACCOUNT_DETAILS',
  WITH_TAGS = 'WITH_TAGS',
  WITH_FILES = 'WITH_FILES',
  WITH_SCHEDULED_UPDATE = 'WITH_SCHEDULED_UPDATE',
  WITH_BLACKLISTED = 'WITH_BLACKLISTED',
  WITH_BLOCKLIST = 'WITH_BLOCKLIST',
  WITH_USER_HISTORY = 'WITH_USER_HISTORY',
  WITH_STREAMING_PLAYLISTS = 'WITH_STREAMING_PLAYLISTS',
  WITH_USER_ID = 'WITH_USER_ID',
  WITH_THUMBNAILS = 'WITH_THUMBNAILS'
}

export type ForAPIOptions = {
  ids?: number[]

  videoPlaylistId?: number

  withFiles?: boolean

  withAccountBlockerIds?: number[]
}

export type AvailableForListIDsOptions = {
  serverAccountId: number
  followerActorId: number
  includeLocalVideos: boolean

  attributesType?: 'none' | 'id' | 'all'

  filter?: VideoFilter
  categoryOneOf?: number[]
  nsfw?: boolean
  licenceOneOf?: number[]
  languageOneOf?: string[]
  tagsOneOf?: string[]
  tagsAllOf?: string[]

  withFiles?: boolean

  accountId?: number
  videoChannelId?: number

  videoPlaylistId?: number

  trendingDays?: number
  user?: MUserAccountId
  historyOfUser?: MUserId

  baseWhere?: WhereOptions[]
}

@Scopes(() => ({
  [ ScopeNames.FOR_API ]: (options: ForAPIOptions) => {
    const query: FindOptions = {
      include: [
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
    }

    if (options.ids) {
      query.where = {
        id: {
          [ Op.in ]: options.ids // FIXME: sequelize ANY seems broken
        }
      }
    }

    if (options.withFiles === true) {
      query.include.push({
        model: VideoFileModel.unscoped(),
        required: true
      })
    }

    if (options.videoPlaylistId) {
      query.include.push({
        model: VideoPlaylistElementModel.unscoped(),
        required: true,
        where: {
          videoPlaylistId: options.videoPlaylistId
        }
      })
    }

    return query
  },
  [ ScopeNames.AVAILABLE_FOR_LIST_IDS ]: (options: AvailableForListIDsOptions) => {
    const whereAnd = options.baseWhere ? options.baseWhere : []

    const query: FindOptions = {
      raw: true,
      include: []
    }

    const attributesType = options.attributesType || 'id'

    if (attributesType === 'id') query.attributes = [ 'id' ]
    else if (attributesType === 'none') query.attributes = [ ]

    whereAnd.push({
      id: {
        [ Op.notIn ]: Sequelize.literal(
          '(SELECT "videoBlacklist"."videoId" FROM "videoBlacklist")'
        )
      }
    })

    if (options.serverAccountId) {
      whereAnd.push({
        channelId: {
          [ Op.notIn ]: Sequelize.literal(
            '(' +
              'SELECT id FROM "videoChannel" WHERE "accountId" IN (' +
                buildBlockedAccountSQL(options.serverAccountId, options.user ? options.user.Account.id : undefined) +
              ')' +
            ')'
          )
        }
      })
    }

    // Only list public/published videos
    if (!options.filter || options.filter !== 'all-local') {
      const privacyWhere = {
        // Always list public videos
        privacy: VideoPrivacy.PUBLIC,
        // Always list published videos, or videos that are being transcoded but on which we don't want to wait for transcoding
        [ Op.or ]: [
          {
            state: VideoState.PUBLISHED
          },
          {
            [ Op.and ]: {
              state: VideoState.TO_TRANSCODE,
              waitTranscoding: false
            }
          }
        ]
      }

      whereAnd.push(privacyWhere)
    }

    if (options.videoPlaylistId) {
      query.include.push({
        attributes: [],
        model: VideoPlaylistElementModel.unscoped(),
        required: true,
        where: {
          videoPlaylistId: options.videoPlaylistId
        }
      })

      query.subQuery = false
    }

    if (options.filter || options.accountId || options.videoChannelId) {
      const videoChannelInclude: IncludeOptions = {
        attributes: [],
        model: VideoChannelModel.unscoped(),
        required: true
      }

      if (options.videoChannelId) {
        videoChannelInclude.where = {
          id: options.videoChannelId
        }
      }

      if (options.filter || options.accountId) {
        const accountInclude: IncludeOptions = {
          attributes: [],
          model: AccountModel.unscoped(),
          required: true
        }

        if (options.filter) {
          accountInclude.include = [
            {
              attributes: [],
              model: ActorModel.unscoped(),
              required: true,
              where: VideoModel.buildActorWhereWithFilter(options.filter)
            }
          ]
        }

        if (options.accountId) {
          accountInclude.where = { id: options.accountId }
        }

        videoChannelInclude.include = [ accountInclude ]
      }

      query.include.push(videoChannelInclude)
    }

    if (options.followerActorId) {
      let localVideosReq = ''
      if (options.includeLocalVideos === true) {
        localVideosReq = ' UNION ALL ' +
          'SELECT "video"."id" AS "id" FROM "video" ' +
          'INNER JOIN "videoChannel" ON "videoChannel"."id" = "video"."channelId" ' +
          'INNER JOIN "account" ON "account"."id" = "videoChannel"."accountId" ' +
          'INNER JOIN "actor" ON "account"."actorId" = "actor"."id" ' +
          'WHERE "actor"."serverId" IS NULL'
      }

      // Force actorId to be a number to avoid SQL injections
      const actorIdNumber = parseInt(options.followerActorId.toString(), 10)
      whereAnd.push({
        id: {
          [ Op.in ]: Sequelize.literal(
            '(' +
            'SELECT "videoShare"."videoId" AS "id" FROM "videoShare" ' +
            'INNER JOIN "actorFollow" ON "actorFollow"."targetActorId" = "videoShare"."actorId" ' +
            'WHERE "actorFollow"."actorId" = ' + actorIdNumber +
            ' UNION ALL ' +
            'SELECT "video"."id" AS "id" FROM "video" ' +
            'INNER JOIN "videoChannel" ON "videoChannel"."id" = "video"."channelId" ' +
            'INNER JOIN "account" ON "account"."id" = "videoChannel"."accountId" ' +
            'INNER JOIN "actor" ON "account"."actorId" = "actor"."id" ' +
            'INNER JOIN "actorFollow" ON "actorFollow"."targetActorId" = "actor"."id" ' +
            'WHERE "actorFollow"."actorId" = ' + actorIdNumber +
            localVideosReq +
            ')'
          )
        }
      })
    }

    if (options.withFiles === true) {
      whereAnd.push({
        id: {
          [ Op.in ]: Sequelize.literal(
            '(SELECT "videoId" FROM "videoFile")'
          )
        }
      })
    }

    // FIXME: issues with sequelize count when making a join on n:m relation, so we just make a IN()
    if (options.tagsAllOf || options.tagsOneOf) {
      if (options.tagsOneOf) {
        whereAnd.push({
          id: {
            [ Op.in ]: Sequelize.literal(
              '(' +
              'SELECT "videoId" FROM "videoTag" ' +
              'INNER JOIN "tag" ON "tag"."id" = "videoTag"."tagId" ' +
              'WHERE "tag"."name" IN (' + createSafeIn(VideoModel, options.tagsOneOf) + ')' +
              ')'
            )
          }
        })
      }

      if (options.tagsAllOf) {
        whereAnd.push({
          id: {
            [ Op.in ]: Sequelize.literal(
              '(' +
              'SELECT "videoId" FROM "videoTag" ' +
              'INNER JOIN "tag" ON "tag"."id" = "videoTag"."tagId" ' +
              'WHERE "tag"."name" IN (' + createSafeIn(VideoModel, options.tagsAllOf) + ')' +
              'GROUP BY "videoTag"."videoId" HAVING COUNT(*) = ' + options.tagsAllOf.length +
              ')'
            )
          }
        })
      }
    }

    if (options.nsfw === true || options.nsfw === false) {
      whereAnd.push({ nsfw: options.nsfw })
    }

    if (options.categoryOneOf) {
      whereAnd.push({
        category: {
          [ Op.or ]: options.categoryOneOf
        }
      })
    }

    if (options.licenceOneOf) {
      whereAnd.push({
        licence: {
          [ Op.or ]: options.licenceOneOf
        }
      })
    }

    if (options.languageOneOf) {
      let videoLanguages = options.languageOneOf
      if (options.languageOneOf.find(l => l === '_unknown')) {
        videoLanguages = videoLanguages.concat([ null ])
      }

      whereAnd.push({
        [Op.or]: [
          {
            language: {
              [ Op.or ]: videoLanguages
            }
          },
          {
            id: {
              [ Op.in ]: Sequelize.literal(
                '(' +
                'SELECT "videoId" FROM "videoCaption" ' +
                'WHERE "language" IN (' + createSafeIn(VideoModel, options.languageOneOf) + ') ' +
                ')'
              )
            }
          }
        ]
      })
    }

    if (options.trendingDays) {
      query.include.push(VideoModel.buildTrendingQuery(options.trendingDays))

      query.subQuery = false
    }

    if (options.historyOfUser) {
      query.include.push({
        model: UserVideoHistoryModel,
        required: true,
        where: {
          userId: options.historyOfUser.id
        }
      })

      // Even if the relation is n:m, we know that a user only have 0..1 video history
      // So we won't have multiple rows for the same video
      // Without this, we would not be able to sort on "updatedAt" column of UserVideoHistoryModel
      query.subQuery = false
    }

    query.where = {
      [ Op.and ]: whereAnd
    }

    return query
  },
  [ScopeNames.WITH_BLOCKLIST]: {

  },
  [ ScopeNames.WITH_THUMBNAILS ]: {
    include: [
      {
        model: ThumbnailModel,
        required: false
      }
    ]
  },
  [ ScopeNames.WITH_USER_ID ]: {
    include: [
      {
        attributes: [ 'accountId' ],
        model: VideoChannelModel.unscoped(),
        required: true,
        include: [
          {
            attributes: [ 'userId' ],
            model: AccountModel.unscoped(),
            required: true
          }
        ]
      }
    ]
  },
  [ ScopeNames.WITH_ACCOUNT_DETAILS ]: {
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
                model: AvatarModel.unscoped(),
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
                    model: AvatarModel.unscoped(),
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
  [ ScopeNames.WITH_TAGS ]: {
    include: [ TagModel ]
  },
  [ ScopeNames.WITH_BLACKLISTED ]: {
    include: [
      {
        attributes: [ 'id', 'reason', 'unfederated' ],
        model: VideoBlacklistModel,
        required: false
      }
    ]
  },
  [ ScopeNames.WITH_FILES ]: (withRedundancies = false) => {
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
          model: VideoFileModel.unscoped(),
          separate: true, // We may have multiple files, having multiple redundancies so let's separate this join
          required: false,
          include: subInclude
        }
      ]
    }
  },
  [ ScopeNames.WITH_STREAMING_PLAYLISTS ]: (withRedundancies = false) => {
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
          model: VideoStreamingPlaylistModel.unscoped(),
          separate: true, // We may have multiple streaming playlists, having multiple redundancies so let's separate this join
          required: false,
          include: subInclude
        }
      ]
    }
  },
  [ ScopeNames.WITH_SCHEDULED_UPDATE ]: {
    include: [
      {
        model: ScheduleVideoUpdateModel.unscoped(),
        required: false
      }
    ]
  },
  [ ScopeNames.WITH_USER_HISTORY ]: (userId: number) => {
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
  indexes
})
export class VideoModel extends Model<VideoModel> {

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
  @Is('VideoCategory', value => throwIfNotValid(value, isVideoCategoryValid, 'category', true))
  @Column
  category: number

  @AllowNull(true)
  @Default(null)
  @Is('VideoLicence', value => throwIfNotValid(value, isVideoLicenceValid, 'licence', true))
  @Column
  licence: number

  @AllowNull(true)
  @Default(null)
  @Is('VideoLanguage', value => throwIfNotValid(value, isVideoLanguageValid, 'language', true))
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.VIDEOS.LANGUAGE.max))
  language: string

  @AllowNull(false)
  @Is('VideoPrivacy', value => throwIfNotValid(value, isVideoPrivacyValid, 'privacy'))
  @Column
  privacy: number

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
    hooks: true
  })
  VideoChannel: VideoChannelModel

  @BelongsToMany(() => TagModel, {
    foreignKey: 'videoId',
    through: () => VideoTagModel,
    onDelete: 'CASCADE'
  })
  Tags: TagModel[]

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

  @HasMany(() => VideoAbuseModel, {
    foreignKey: {
      name: 'videoId',
      allowNull: false
    },
    onDelete: 'cascade'
  })
  VideoAbuses: VideoAbuseModel[]

  @HasMany(() => VideoFileModel, {
    foreignKey: {
      name: 'videoId',
      allowNull: false
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
    [ 'separate' as any ]: true
  })
  VideoCaptions: VideoCaptionModel[]

  @BeforeDestroy
  static async sendDelete (instance: MVideoAccountLight, options) {
    if (instance.isOwned()) {
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

    return undefined
  }

  @BeforeDestroy
  static async removeFiles (instance: VideoModel) {
    const tasks: Promise<any>[] = []

    logger.info('Removing files of video %s.', instance.url)

    if (instance.isOwned()) {
      if (!Array.isArray(instance.VideoFiles)) {
        instance.VideoFiles = await instance.$get('VideoFiles') as VideoFileModel[]
      }

      // Remove physical files and torrents
      instance.VideoFiles.forEach(file => {
        tasks.push(instance.removeFile(file))
        tasks.push(instance.removeTorrent(file))
      })

      // Remove playlists file
      tasks.push(instance.removeStreamingPlaylist())
    }

    // Do not wait video deletion because we could be in a transaction
    Promise.all(tasks)
           .catch(err => {
             logger.error('Some errors when removing files of video %s in before destroy hook.', instance.uuid, { err })
           })

    return undefined
  }

  static listLocal (): Bluebird<MVideoWithAllFiles[]> {
    const query = {
      where: {
        remote: false
      }
    }

    return VideoModel.scope([
      ScopeNames.WITH_FILES,
      ScopeNames.WITH_STREAMING_PLAYLISTS,
      ScopeNames.WITH_THUMBNAILS
    ]).findAll(query)
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
      order: getVideoSort('createdAt', [ 'Tags', 'name', 'ASC' ] as any), // FIXME: sequelize typings
      where: {
        id: {
          [ Op.in ]: Sequelize.literal('(' + rawQuery + ')')
        },
        [ Op.or ]: [
          { privacy: VideoPrivacy.PUBLIC },
          { privacy: VideoPrivacy.UNLISTED }
        ]
      },
      include: [
        {
          attributes: [ 'language' ],
          model: VideoCaptionModel.unscoped(),
          required: false
        },
        {
          attributes: [ 'id', 'url' ],
          model: VideoShareModel.unscoped(),
          required: false,
          // We only want videos shared by this actor
          where: {
            [ Op.and ]: [
              {
                id: {
                  [ Op.not ]: null
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
      if (totals[ 0 ]) totalVideos = parseInt(totals[ 0 ].total, 10)
      if (totals[ 1 ]) totalVideoShares = parseInt(totals[ 1 ].total, 10)

      const total = totalVideos + totalVideoShares
      return {
        data: rows,
        total: total
      }
    })
  }

  static listUserVideosForApi (accountId: number, start: number, count: number, sort: string) {
    function buildBaseQuery (): FindOptions {
      return {
        offset: start,
        limit: count,
        order: getVideoSort(sort),
        include: [
          {
            model: VideoChannelModel,
            required: true,
            include: [
              {
                model: AccountModel,
                where: {
                  id: accountId
                },
                required: true
              }
            ]
          }
        ]
      }
    }

    const countQuery = buildBaseQuery()
    const findQuery = buildBaseQuery()

    const findScopes = [
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
    start: number,
    count: number,
    sort: string,
    nsfw: boolean,
    includeLocalVideos: boolean,
    withFiles: boolean,
    categoryOneOf?: number[],
    licenceOneOf?: number[],
    languageOneOf?: string[],
    tagsOneOf?: string[],
    tagsAllOf?: string[],
    filter?: VideoFilter,
    accountId?: number,
    videoChannelId?: number,
    followerActorId?: number
    videoPlaylistId?: number,
    trendingDays?: number,
    user?: MUserAccountId,
    historyOfUser?: MUserId
  }, countVideos = true) {
    if (options.filter && options.filter === 'all-local' && !options.user.hasRight(UserRight.SEE_ALL_VIDEOS)) {
      throw new Error('Try to filter all-local but no user has not the see all videos right')
    }

    const query: FindOptions & { where?: null } = {
      offset: options.start,
      limit: options.count,
      order: getVideoSort(options.sort)
    }

    let trendingDays: number
    if (options.sort.endsWith('trending')) {
      trendingDays = CONFIG.TRENDING.VIDEOS.INTERVAL_DAYS

      query.group = 'VideoModel.id'
    }

    const serverActor = await getServerActor()

    // followerActorId === null has a meaning, so just check undefined
    const followerActorId = options.followerActorId !== undefined ? options.followerActorId : serverActor.id

    const queryOptions = {
      followerActorId,
      serverAccountId: serverActor.Account.id,
      nsfw: options.nsfw,
      categoryOneOf: options.categoryOneOf,
      licenceOneOf: options.licenceOneOf,
      languageOneOf: options.languageOneOf,
      tagsOneOf: options.tagsOneOf,
      tagsAllOf: options.tagsAllOf,
      filter: options.filter,
      withFiles: options.withFiles,
      accountId: options.accountId,
      videoChannelId: options.videoChannelId,
      videoPlaylistId: options.videoPlaylistId,
      includeLocalVideos: options.includeLocalVideos,
      user: options.user,
      historyOfUser: options.historyOfUser,
      trendingDays
    }

    return VideoModel.getAvailableForApi(query, queryOptions, countVideos)
  }

  static async searchAndPopulateAccountAndServer (options: {
    includeLocalVideos: boolean
    search?: string
    start?: number
    count?: number
    sort?: string
    startDate?: string // ISO 8601
    endDate?: string // ISO 8601
    originallyPublishedStartDate?: string
    originallyPublishedEndDate?: string
    nsfw?: boolean
    categoryOneOf?: number[]
    licenceOneOf?: number[]
    languageOneOf?: string[]
    tagsOneOf?: string[]
    tagsAllOf?: string[]
    durationMin?: number // seconds
    durationMax?: number // seconds
    user?: MUserAccountId,
    filter?: VideoFilter
  }) {
    const whereAnd = []

    if (options.startDate || options.endDate) {
      const publishedAtRange = {}

      if (options.startDate) publishedAtRange[ Op.gte ] = options.startDate
      if (options.endDate) publishedAtRange[ Op.lte ] = options.endDate

      whereAnd.push({ publishedAt: publishedAtRange })
    }

    if (options.originallyPublishedStartDate || options.originallyPublishedEndDate) {
      const originallyPublishedAtRange = {}

      if (options.originallyPublishedStartDate) originallyPublishedAtRange[ Op.gte ] = options.originallyPublishedStartDate
      if (options.originallyPublishedEndDate) originallyPublishedAtRange[ Op.lte ] = options.originallyPublishedEndDate

      whereAnd.push({ originallyPublishedAt: originallyPublishedAtRange })
    }

    if (options.durationMin || options.durationMax) {
      const durationRange = {}

      if (options.durationMin) durationRange[ Op.gte ] = options.durationMin
      if (options.durationMax) durationRange[ Op.lte ] = options.durationMax

      whereAnd.push({ duration: durationRange })
    }

    const attributesInclude = []
    const escapedSearch = VideoModel.sequelize.escape(options.search)
    const escapedLikeSearch = VideoModel.sequelize.escape('%' + options.search + '%')
    if (options.search) {
      whereAnd.push(
        {
          id: {
            [ Op.in ]: Sequelize.literal(
              '(' +
              'SELECT "video"."id" FROM "video" ' +
              'WHERE ' +
              'lower(immutable_unaccent("video"."name")) % lower(immutable_unaccent(' + escapedSearch + ')) OR ' +
              'lower(immutable_unaccent("video"."name")) LIKE lower(immutable_unaccent(' + escapedLikeSearch + '))' +
              'UNION ALL ' +
              'SELECT "video"."id" FROM "video" LEFT JOIN "videoTag" ON "videoTag"."videoId" = "video"."id" ' +
              'INNER JOIN "tag" ON "tag"."id" = "videoTag"."tagId" ' +
              'WHERE "tag"."name" = ' + escapedSearch +
              ')'
            )
          }
        }
      )

      attributesInclude.push(createSimilarityAttribute('VideoModel.name', options.search))
    }

    // Cannot search on similarity if we don't have a search
    if (!options.search) {
      attributesInclude.push(
        Sequelize.literal('0 as similarity')
      )
    }

    const query = {
      attributes: {
        include: attributesInclude
      },
      offset: options.start,
      limit: options.count,
      order: getVideoSort(options.sort)
    }

    const serverActor = await getServerActor()
    const queryOptions = {
      followerActorId: serverActor.id,
      serverAccountId: serverActor.Account.id,
      includeLocalVideos: options.includeLocalVideos,
      nsfw: options.nsfw,
      categoryOneOf: options.categoryOneOf,
      licenceOneOf: options.licenceOneOf,
      languageOneOf: options.languageOneOf,
      tagsOneOf: options.tagsOneOf,
      tagsAllOf: options.tagsAllOf,
      user: options.user,
      filter: options.filter,
      baseWhere: whereAnd
    }

    return VideoModel.getAvailableForApi(query, queryOptions)
  }

  static load (id: number | string, t?: Transaction): Bluebird<MVideoThumbnail> {
    const where = buildWhereIdOrUUID(id)
    const options = {
      where,
      transaction: t
    }

    return VideoModel.scope(ScopeNames.WITH_THUMBNAILS).findOne(options)
  }

  static loadWithBlacklist (id: number | string, t?: Transaction): Bluebird<MVideoThumbnailBlacklist> {
    const where = buildWhereIdOrUUID(id)
    const options = {
      where,
      transaction: t
    }

    return VideoModel.scope([
      ScopeNames.WITH_THUMBNAILS,
      ScopeNames.WITH_BLACKLISTED
    ]).findOne(options)
  }

  static loadWithRights (id: number | string, t?: Transaction): Bluebird<MVideoWithRights> {
    const where = buildWhereIdOrUUID(id)
    const options = {
      where,
      transaction: t
    }

    return VideoModel.scope([
      ScopeNames.WITH_BLACKLISTED,
      ScopeNames.WITH_USER_ID,
      ScopeNames.WITH_THUMBNAILS
    ]).findOne(options)
  }

  static loadOnlyId (id: number | string, t?: Transaction): Bluebird<MVideoIdThumbnail> {
    const where = buildWhereIdOrUUID(id)

    const options = {
      attributes: [ 'id' ],
      where,
      transaction: t
    }

    return VideoModel.scope(ScopeNames.WITH_THUMBNAILS).findOne(options)
  }

  static loadWithFiles (id: number | string, t?: Transaction, logging?: boolean): Bluebird<MVideoWithAllFiles> {
    const where = buildWhereIdOrUUID(id)

    const query = {
      where,
      transaction: t,
      logging
    }

    return VideoModel.scope([
      ScopeNames.WITH_FILES,
      ScopeNames.WITH_STREAMING_PLAYLISTS,
      ScopeNames.WITH_THUMBNAILS
    ]).findOne(query)
  }

  static loadByUUID (uuid: string): Bluebird<MVideoThumbnail> {
    const options = {
      where: {
        uuid
      }
    }

    return VideoModel.scope(ScopeNames.WITH_THUMBNAILS).findOne(options)
  }

  static loadByUrl (url: string, transaction?: Transaction): Bluebird<MVideoThumbnail> {
    const query: FindOptions = {
      where: {
        url
      },
      transaction
    }

    return VideoModel.scope(ScopeNames.WITH_THUMBNAILS).findOne(query)
  }

  static loadByUrlAndPopulateAccount (url: string, transaction?: Transaction): Bluebird<MVideoAccountLightBlacklistAllFiles> {
    const query: FindOptions = {
      where: {
        url
      },
      transaction
    }

    return VideoModel.scope([
      ScopeNames.WITH_ACCOUNT_DETAILS,
      ScopeNames.WITH_FILES,
      ScopeNames.WITH_STREAMING_PLAYLISTS,
      ScopeNames.WITH_THUMBNAILS,
      ScopeNames.WITH_BLACKLISTED
    ]).findOne(query)
  }

  static loadAndPopulateAccountAndServerAndTags (id: number | string, t?: Transaction, userId?: number): Bluebird<MVideoFullLight> {
    const where = buildWhereIdOrUUID(id)

    const options = {
      order: [ [ 'Tags', 'name', 'ASC' ] ] as any,
      where,
      transaction: t
    }

    const scopes: (string | ScopeOptions)[] = [
      ScopeNames.WITH_TAGS,
      ScopeNames.WITH_BLACKLISTED,
      ScopeNames.WITH_ACCOUNT_DETAILS,
      ScopeNames.WITH_SCHEDULED_UPDATE,
      ScopeNames.WITH_FILES,
      ScopeNames.WITH_STREAMING_PLAYLISTS,
      ScopeNames.WITH_THUMBNAILS
    ]

    if (userId) {
      scopes.push({ method: [ ScopeNames.WITH_USER_HISTORY, userId ] })
    }

    return VideoModel
      .scope(scopes)
      .findOne(options)
  }

  static loadForGetAPI (parameters: {
    id: number | string,
    t?: Transaction,
    userId?: number
  }): Bluebird<MVideoDetails> {
    const { id, t, userId } = parameters
    const where = buildWhereIdOrUUID(id)

    const options = {
      order: [ [ 'Tags', 'name', 'ASC' ] ] as any, // FIXME: sequelize typings
      where,
      transaction: t
    }

    const scopes: (string | ScopeOptions)[] = [
      ScopeNames.WITH_TAGS,
      ScopeNames.WITH_BLACKLISTED,
      ScopeNames.WITH_ACCOUNT_DETAILS,
      ScopeNames.WITH_SCHEDULED_UPDATE,
      ScopeNames.WITH_THUMBNAILS,
      { method: [ ScopeNames.WITH_FILES, true ] },
      { method: [ ScopeNames.WITH_STREAMING_PLAYLISTS, true ] }
    ]

    if (userId) {
      scopes.push({ method: [ ScopeNames.WITH_USER_HISTORY, userId ] })
    }

    return VideoModel
      .scope(scopes)
      .findOne(options)
  }

  static async getStats () {
    const totalLocalVideos = await VideoModel.count({
      where: {
        remote: false
      }
    })
    const totalVideos = await VideoModel.count()

    let totalLocalVideoViews = await VideoModel.sum('views', {
      where: {
        remote: false
      }
    })
    // Sequelize could return null...
    if (!totalLocalVideoViews) totalLocalVideoViews = 0

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

  static checkVideoHasInstanceFollow (videoId: number, followerActorId: number) {
    // Instances only share videos
    const query = 'SELECT 1 FROM "videoShare" ' +
    'INNER JOIN "actorFollow" ON "actorFollow"."targetActorId" = "videoShare"."actorId" ' +
    'WHERE "actorFollow"."actorId" = $followerActorId AND "videoShare"."videoId" = $videoId ' +
    'LIMIT 1'

    const options = {
      type: QueryTypes.SELECT,
      bind: { followerActorId, videoId },
      raw: true
    }

    return VideoModel.sequelize.query(query, options)
                     .then(results => results.length === 1)
  }

  static bulkUpdateSupportField (videoChannel: MChannel, t: Transaction) {
    const options = {
      where: {
        channelId: videoChannel.id
      },
      transaction: t
    }

    return VideoModel.update({ support: videoChannel.support }, options)
  }

  static getAllIdsFromChannel (videoChannel: MChannelId): Bluebird<number[]> {
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
    const followerActorId = serverActor.id

    const scopeOptions: AvailableForListIDsOptions = {
      serverAccountId: serverActor.Account.id,
      followerActorId,
      includeLocalVideos: true,
      attributesType: 'none' // Don't break aggregation
    }

    const query: FindOptions = {
      attributes: [ field ],
      limit: count,
      group: field,
      having: Sequelize.where(
        Sequelize.fn('COUNT', Sequelize.col(field)), { [ Op.gte ]: threshold }
      ),
      order: [ (this.sequelize as any).random() ]
    }

    return VideoModel.scope({ method: [ ScopeNames.AVAILABLE_FOR_LIST_IDS, scopeOptions ] })
                     .findAll(query)
                     .then(rows => rows.map(r => r[ field ]))
  }

  static buildTrendingQuery (trendingDays: number) {
    return {
      attributes: [],
      subQuery: false,
      model: VideoViewModel,
      required: false,
      where: {
        startDate: {
          [ Op.gte ]: new Date(new Date().getTime() - (24 * 3600 * 1000) * trendingDays)
        }
      }
    }
  }

  private static buildActorWhereWithFilter (filter?: VideoFilter) {
    if (filter && (filter === 'local' || filter === 'all-local')) {
      return {
        serverId: null
      }
    }

    return {}
  }

  private static async getAvailableForApi (
    query: FindOptions & { where?: null }, // Forbid where field in query
    options: AvailableForListIDsOptions,
    countVideos = true
  ) {
    const idsScope: ScopeOptions = {
      method: [
        ScopeNames.AVAILABLE_FOR_LIST_IDS, options
      ]
    }

    // Remove trending sort on count, because it uses a group by
    const countOptions = Object.assign({}, options, { trendingDays: undefined })
    const countQuery: CountOptions = Object.assign({}, query, { attributes: undefined, group: undefined })
    const countScope: ScopeOptions = {
      method: [
        ScopeNames.AVAILABLE_FOR_LIST_IDS, countOptions
      ]
    }

    const [ count, ids ] = await Promise.all([
      countVideos
        ? VideoModel.scope(countScope).count(countQuery)
        : Promise.resolve<number>(undefined),

      VideoModel.scope(idsScope)
                .findAll(query)
                .then(rows => rows.map(r => r.id))
    ])

    if (ids.length === 0) return { data: [], total: count }

    const secondQuery: FindOptions = {
      offset: 0,
      limit: query.limit,
      attributes: query.attributes,
      order: [ // Keep original order
        Sequelize.literal(
          ids.map(id => `"VideoModel".id = ${id} DESC`).join(', ')
        )
      ]
    }

    const apiScope: (string | ScopeOptions)[] = []

    if (options.user) {
      apiScope.push({ method: [ ScopeNames.WITH_USER_HISTORY, options.user.id ] })
    }

    apiScope.push({
      method: [
        ScopeNames.FOR_API, {
          ids,
          withFiles: options.withFiles,
          videoPlaylistId: options.videoPlaylistId
        } as ForAPIOptions
      ]
    })

    const rows = await VideoModel.scope(apiScope).findAll(secondQuery)

    return {
      data: rows,
      total: count
    }
  }

  static getCategoryLabel (id: number) {
    return VIDEO_CATEGORIES[ id ] || 'Misc'
  }

  static getLicenceLabel (id: number) {
    return VIDEO_LICENCES[ id ] || 'Unknown'
  }

  static getLanguageLabel (id: string) {
    return VIDEO_LANGUAGES[ id ] || 'Unknown'
  }

  static getPrivacyLabel (id: number) {
    return VIDEO_PRIVACIES[ id ] || 'Unknown'
  }

  static getStateLabel (id: number) {
    return VIDEO_STATES[ id ] || 'Unknown'
  }

  isBlacklisted () {
    return !!this.VideoBlacklist
  }

  isBlocked () {
    return (this.VideoChannel.Account.Actor.Server && this.VideoChannel.Account.Actor.Server.isBlocked()) ||
      this.VideoChannel.Account.isBlocked()
  }

  getOriginalFile <T extends MVideoWithFile> (this: T) {
    if (Array.isArray(this.VideoFiles) === false) return undefined

    // The original file is the file that have the higher resolution
    return maxBy(this.VideoFiles, file => file.resolution)
  }

  getFile <T extends MVideoWithFile> (this: T, resolution: number) {
    if (Array.isArray(this.VideoFiles) === false) return undefined

    return this.VideoFiles.find(f => f.resolution === resolution)
  }

  async addAndSaveThumbnail (thumbnail: MThumbnail, transaction: Transaction) {
    thumbnail.videoId = this.id

    const savedThumbnail = await thumbnail.save({ transaction })

    if (Array.isArray(this.Thumbnails) === false) this.Thumbnails = []

    // Already have this thumbnail, skip
    if (this.Thumbnails.find(t => t.id === savedThumbnail.id)) return

    this.Thumbnails.push(savedThumbnail)
  }

  getVideoFilename (videoFile: MVideoFile) {
    return this.uuid + '-' + videoFile.resolution + videoFile.extname
  }

  generateThumbnailName () {
    return this.uuid + '.jpg'
  }

  getMiniature () {
    if (Array.isArray(this.Thumbnails) === false) return undefined

    return this.Thumbnails.find(t => t.type === ThumbnailType.MINIATURE)
  }

  generatePreviewName () {
    return this.uuid + '.jpg'
  }

  getPreview () {
    if (Array.isArray(this.Thumbnails) === false) return undefined

    return this.Thumbnails.find(t => t.type === ThumbnailType.PREVIEW)
  }

  getTorrentFileName (videoFile: MVideoFile) {
    const extension = '.torrent'
    return this.uuid + '-' + videoFile.resolution + extension
  }

  isOwned () {
    return this.remote === false
  }

  getTorrentFilePath (videoFile: MVideoFile) {
    return join(CONFIG.STORAGE.TORRENTS_DIR, this.getTorrentFileName(videoFile))
  }

  getVideoFilePath (videoFile: MVideoFile) {
    return join(CONFIG.STORAGE.VIDEOS_DIR, this.getVideoFilename(videoFile))
  }

  async createTorrentAndSetInfoHash (videoFile: MVideoFile) {
    const options = {
      // Keep the extname, it's used by the client to stream the file inside a web browser
      name: `${this.name} ${videoFile.resolution}p${videoFile.extname}`,
      createdBy: 'PeerTube',
      announceList: [
        [ WEBSERVER.WS + '://' + WEBSERVER.HOSTNAME + ':' + WEBSERVER.PORT + '/tracker/socket' ],
        [ WEBSERVER.URL + '/tracker/announce' ]
      ],
      urlList: [ WEBSERVER.URL + STATIC_PATHS.WEBSEED + this.getVideoFilename(videoFile) ]
    }

    const torrent = await createTorrentPromise(this.getVideoFilePath(videoFile), options)

    const filePath = join(CONFIG.STORAGE.TORRENTS_DIR, this.getTorrentFileName(videoFile))
    logger.info('Creating torrent %s.', filePath)

    await writeFile(filePath, torrent)

    const parsedTorrent = parseTorrent(torrent)
    videoFile.infoHash = parsedTorrent.infoHash
  }

  getWatchStaticPath () {
    return '/videos/watch/' + this.uuid
  }

  getEmbedStaticPath () {
    return '/videos/embed/' + this.uuid
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

  getFormattedVideoFilesJSON (): VideoFile[] {
    return videoFilesModelToFormattedJSON(this, this.VideoFiles)
  }

  toActivityPubObject (this: MVideoAP): VideoTorrentObject {
    return videoModelToActivityPubObject(this)
  }

  getTruncatedDescription () {
    if (!this.description) return null

    const maxLength = CONSTRAINTS_FIELDS.VIDEOS.TRUNCATED_DESCRIPTION.max
    return peertubeTruncate(this.description, maxLength)
  }

  getOriginalFileResolution () {
    const originalFilePath = this.getVideoFilePath(this.getOriginalFile())

    return getVideoFileResolution(originalFilePath)
  }

  getDescriptionAPIPath () {
    return `/api/${API_VERSION}/videos/${this.uuid}/description`
  }

  getHLSPlaylist () {
    if (!this.VideoStreamingPlaylists) return undefined

    return this.VideoStreamingPlaylists.find(p => p.type === VideoStreamingPlaylistType.HLS)
  }

  removeFile (videoFile: MVideoFile, isRedundancy = false) {
    const baseDir = isRedundancy ? CONFIG.STORAGE.REDUNDANCY_DIR : CONFIG.STORAGE.VIDEOS_DIR

    const filePath = join(baseDir, this.getVideoFilename(videoFile))
    return remove(filePath)
      .catch(err => logger.warn('Cannot delete file %s.', filePath, { err }))
  }

  removeTorrent (videoFile: MVideoFile) {
    const torrentPath = join(CONFIG.STORAGE.TORRENTS_DIR, this.getTorrentFileName(videoFile))
    return remove(torrentPath)
      .catch(err => logger.warn('Cannot delete torrent %s.', torrentPath, { err }))
  }

  removeStreamingPlaylist (isRedundancy = false) {
    const baseDir = isRedundancy ? HLS_REDUNDANCY_DIRECTORY : HLS_STREAMING_PLAYLIST_DIRECTORY

    const filePath = join(baseDir, this.uuid)
    return remove(filePath)
      .catch(err => logger.warn('Cannot delete playlist directory %s.', filePath, { err }))
  }

  isOutdated () {
    if (this.isOwned()) return false

    return isOutdated(this, ACTIVITY_PUB.VIDEO_REFRESH_INTERVAL)
  }

  setAsRefreshed () {
    this.changed('updatedAt', true)

    return this.save()
  }

  getBaseUrls () {
    let baseUrlHttp
    let baseUrlWs

    if (this.isOwned()) {
      baseUrlHttp = WEBSERVER.URL
      baseUrlWs = WEBSERVER.WS + '://' + WEBSERVER.HOSTNAME + ':' + WEBSERVER.PORT
    } else {
      baseUrlHttp = REMOTE_SCHEME.HTTP + '://' + this.VideoChannel.Account.Actor.Server.host
      baseUrlWs = REMOTE_SCHEME.WS + '://' + this.VideoChannel.Account.Actor.Server.host
    }

    return { baseUrlHttp, baseUrlWs }
  }

  generateMagnetUri (videoFile: MVideoFileRedundanciesOpt, baseUrlHttp: string, baseUrlWs: string) {
    const xs = this.getTorrentUrl(videoFile, baseUrlHttp)
    const announce = this.getTrackerUrls(baseUrlHttp, baseUrlWs)
    let urlList = [ this.getVideoFileUrl(videoFile, baseUrlHttp) ]

    const redundancies = videoFile.RedundancyVideos
    if (isArray(redundancies)) urlList = urlList.concat(redundancies.map(r => r.fileUrl))

    const magnetHash = {
      xs,
      announce,
      urlList,
      infoHash: videoFile.infoHash,
      name: this.name
    }

    return magnetUtil.encode(magnetHash)
  }

  getTrackerUrls (baseUrlHttp: string, baseUrlWs: string) {
    return [ baseUrlWs + '/tracker/socket', baseUrlHttp + '/tracker/announce' ]
  }

  getTorrentUrl (videoFile: MVideoFile, baseUrlHttp: string) {
    return baseUrlHttp + STATIC_PATHS.TORRENTS + this.getTorrentFileName(videoFile)
  }

  getTorrentDownloadUrl (videoFile: MVideoFile, baseUrlHttp: string) {
    return baseUrlHttp + STATIC_DOWNLOAD_PATHS.TORRENTS + this.getTorrentFileName(videoFile)
  }

  getVideoFileUrl (videoFile: MVideoFile, baseUrlHttp: string) {
    return baseUrlHttp + STATIC_PATHS.WEBSEED + this.getVideoFilename(videoFile)
  }

  getVideoRedundancyUrl (videoFile: MVideoFile, baseUrlHttp: string) {
    return baseUrlHttp + STATIC_PATHS.REDUNDANCY + this.getVideoFilename(videoFile)
  }

  getVideoFileDownloadUrl (videoFile: MVideoFile, baseUrlHttp: string) {
    return baseUrlHttp + STATIC_DOWNLOAD_PATHS.VIDEOS + this.getVideoFilename(videoFile)
  }

  getBandwidthBits (videoFile: MVideoFile) {
    return Math.ceil((videoFile.size * 8) / this.duration)
  }
}
