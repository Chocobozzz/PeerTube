import * as Bluebird from 'bluebird'
import { maxBy } from 'lodash'
import * as magnetUtil from 'magnet-uri'
import * as parseTorrent from 'parse-torrent'
import { join } from 'path'
import * as Sequelize from 'sequelize'
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
  IFindOptions,
  IIncludeOptions,
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
import { createTorrentPromise, peertubeTruncate } from '../../helpers/core-utils'
import { isActivityPubUrlValid } from '../../helpers/custom-validators/activitypub/misc'
import { isArray, isBooleanValid } from '../../helpers/custom-validators/misc'
import {
  isVideoCategoryValid,
  isVideoDescriptionValid,
  isVideoDurationValid,
  isVideoLanguageValid,
  isVideoLicenceValid,
  isVideoNameValid,
  isVideoArticleidValid,
  isVideoPrivacyValid,
  isVideoStateValid,
  isVideoSupportValid
} from '../../helpers/custom-validators/videos'
import { generateImageFromVideoFile, getVideoFileResolution } from '../../helpers/ffmpeg-utils'
import { logger } from '../../helpers/logger'
import { getServerActor } from '../../helpers/utils'
import {
  ACTIVITY_PUB,
  API_VERSION,
  CONFIG,
  CONSTRAINTS_FIELDS,
  PREVIEWS_SIZE,
  REMOTE_SCHEME,
  STATIC_DOWNLOAD_PATHS,
  STATIC_PATHS,
  THUMBNAILS_SIZE,
  VIDEO_CATEGORIES,
  VIDEO_LANGUAGES,
  VIDEO_LICENCES,
  VIDEO_PRIVACIES,
  VIDEO_STATES
} from '../../initializers'
import { sendDeleteVideo } from '../../lib/activitypub/send'
import { AccountModel } from '../account/account'
import { AccountVideoRateModel } from '../account/account-video-rate'
import { ActorModel } from '../activitypub/actor'
import { AvatarModel } from '../avatar/avatar'
import { ServerModel } from '../server/server'
import { buildBlockedAccountSQL, buildTrigramSearchIndex, createSimilarityAttribute, getVideoSort, throwIfNotValid } from '../utils'
import { TagModel } from './tag'
import { AutorModel } from './autor'
import { VideoAbuseModel } from './video-abuse'
import { VideoChannelModel } from './video-channel'
import { VideoCommentModel } from './video-comment'
import { VideoFileModel } from './video-file'
import { VideoShareModel } from './video-share'
import { VideoTagModel } from './video-tag'
import { VideoAutorModel } from './video-autor'
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
import * as validator from 'validator'
import { UserVideoHistoryModel } from '../account/user-video-history'
import { UserModel } from '../account/user'

// FIXME: Define indexes here because there is an issue with TS and Sequelize.literal when called directly in the annotation
const indexes: Sequelize.DefineIndexesOptions[] = [
  buildTrigramSearchIndex('video_name_trigram', 'name'),

  { fields: [ 'createdAt' ] },
  { fields: [ 'publishedAt' ] },
  { fields: [ 'duration' ] },
  { fields: [ 'category' ] },
  { fields: [ 'licence' ] },
  { fields: [ 'articleid' ] },
  { fields: [ 'nsfw' ] },
  { fields: [ 'language' ] },
  { fields: [ 'waitTranscoding' ] },
  { fields: [ 'state' ] },
  { fields: [ 'remote' ] },
  { fields: [ 'views' ] },
  { fields: [ 'likes' ] },
  { fields: [ 'channelId' ] },
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
  WITH_AUTORS = 'WITH_AUTORS',
  WITH_FILES = 'WITH_FILES',
  WITH_SCHEDULED_UPDATE = 'WITH_SCHEDULED_UPDATE',
  WITH_BLACKLISTED = 'WITH_BLACKLISTED',
  WITH_USER_HISTORY = 'WITH_USER_HISTORY'
}

type ForAPIOptions = {
  ids: number[]
  withFiles?: boolean
}

type AvailableForListIDsOptions = {
  serverAccountId: number
  actorId: number
  includeLocalVideos: boolean
  filter?: VideoFilter
  categoryOneOf?: number[]
  nsfw?: boolean
  licenceOneOf?: number[]
  languageOneOf?: string[]
  tagsOneOf?: string[]
  tagsAllOf?: string[]
  autorsOneOf?: string[]
  autorsAllOf?: string[]
  withFiles?: boolean
  accountId?: number
  videoChannelId?: number
  trendingDays?: number
  user?: UserModel
}

@Scopes({
  [ ScopeNames.FOR_API ]: (options: ForAPIOptions) => {
    const accountInclude = {
      attributes: [ 'id', 'name' ],
      model: AccountModel.unscoped(),
      required: true,
      include: [
        {
          attributes: [ 'id', 'uuid', 'preferredUsername', 'url', 'serverId', 'avatarId' ],
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
        }
      ]
    }

    const videoChannelInclude = {
      attributes: [ 'name', 'description', 'id' ],
      model: VideoChannelModel.unscoped(),
      required: true,
      include: [
        {
          attributes: [ 'uuid', 'preferredUsername', 'url', 'serverId', 'avatarId' ],
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
        accountInclude
      ]
    }

    const query: IFindOptions<VideoModel> = {
      where: {
        id: {
          [ Sequelize.Op.any ]: options.ids
        }
      },
      include: [ videoChannelInclude ]
    }

    if (options.withFiles === true) {
      query.include.push({
        model: VideoFileModel.unscoped(),
        required: true
      })
    }

    return query
  },
  [ ScopeNames.AVAILABLE_FOR_LIST_IDS ]: (options: AvailableForListIDsOptions) => {
    const query: IFindOptions<VideoModel> = {
      raw: true,
      attributes: [ 'id' ],
      where: {
        id: {
          [ Sequelize.Op.and ]: [
            {
              [ Sequelize.Op.notIn ]: Sequelize.literal(
                '(SELECT "videoBlacklist"."videoId" FROM "videoBlacklist")'
              )
            }
          ]
        },
        channelId: {
          [ Sequelize.Op.notIn ]: Sequelize.literal(
            '(' +
              'SELECT id FROM "videoChannel" WHERE "accountId" IN (' +
                buildBlockedAccountSQL(options.serverAccountId, options.user ? options.user.Account.id : undefined) +
              ')' +
            ')'
          )
        }
      },
      include: []
    }

    // Only list public/published videos
    if (!options.filter || options.filter !== 'all-local') {
      const privacyWhere = {
        // Always list public videos
        privacy: VideoPrivacy.PUBLIC,
        // Always list published videos, or videos that are being transcoded but on which we don't want to wait for transcoding
        [ Sequelize.Op.or ]: [
          {
            state: VideoState.PUBLISHED
          },
          {
            [ Sequelize.Op.and ]: {
              state: VideoState.TO_TRANSCODE,
              waitTranscoding: false
            }
          }
        ]
      }

      Object.assign(query.where, privacyWhere)
    }

    if (options.filter || options.accountId || options.videoChannelId) {
      const videoChannelInclude: IIncludeOptions = {
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
        const accountInclude: IIncludeOptions = {
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

    if (options.actorId) {
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
      const actorIdNumber = parseInt(options.actorId.toString(), 10)
      query.where[ 'id' ][ Sequelize.Op.and ].push({
        [ Sequelize.Op.in ]: Sequelize.literal(
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
      })
    }

    if (options.withFiles === true) {
      query.where[ 'id' ][ Sequelize.Op.and ].push({
        [ Sequelize.Op.in ]: Sequelize.literal(
          '(SELECT "videoId" FROM "videoFile")'
        )
      })
    }

    // FIXME: issues with sequelize count when making a join on n:m relation, so we just make a IN()
    if (options.tagsAllOf || options.tagsOneOf) {
      const createTagsIn = (tags: string[]) => {
        return tags.map(t => VideoModel.sequelize.escape(t))
                   .join(', ')
      }

      if (options.tagsOneOf) {
        query.where[ 'id' ][ Sequelize.Op.and ].push({
          [ Sequelize.Op.in ]: Sequelize.literal(
            '(' +
            'SELECT "videoId" FROM "videoTag" ' +
            'INNER JOIN "tag" ON "tag"."id" = "videoTag"."tagId" ' +
            'WHERE "tag"."name" IN (' + createTagsIn(options.tagsOneOf) + ')' +
            ')'
          )
        })
      }

      if (options.tagsAllOf) {
        query.where[ 'id' ][ Sequelize.Op.and ].push({
          [ Sequelize.Op.in ]: Sequelize.literal(
            '(' +
            'SELECT "videoId" FROM "videoTag" ' +
            'INNER JOIN "tag" ON "tag"."id" = "videoTag"."tagId" ' +
            'WHERE "tag"."name" IN (' + createTagsIn(options.tagsAllOf) + ')' +
            'GROUP BY "videoTag"."videoId" HAVING COUNT(*) = ' + options.tagsAllOf.length +
            ')'
          )
        })
      }
    }

    if (options.autorsAllOf || options.autorsOneOf) {
      const createAutorsIn = (autors: string[]) => {
        return autors.map(t => VideoModel.sequelize.escape(t))
                   .join(', ')
      }

      if (options.autorsOneOf) {
        query.where[ 'id' ][ Sequelize.Op.and ].push({
          [ Sequelize.Op.in ]: Sequelize.literal(
            '(' +
            'SELECT "videoId" FROM "videoAutor" ' +
            'INNER JOIN "autor" ON "autor"."id" = "videoAutor"."autorId" ' +
            'WHERE "autor"."name" IN (' + createAutorsIn(options.autorsOneOf) + ')' +
            ')'
          )
        })
      }

      if (options.autorsAllOf) {
        query.where[ 'id' ][ Sequelize.Op.and ].push({
          [ Sequelize.Op.in ]: Sequelize.literal(
            '(' +
            'SELECT "videoId" FROM "videoAutor" ' +
            'INNER JOIN "autor" ON "autor"."id" = "videoAutor"."autorId" ' +
            'WHERE "autor"."name" IN (' + createAutorsIn(options.autorsAllOf) + ')' +
            'GROUP BY "videoAutor"."videoId" HAVING COUNT(*) = ' + options.autorsAllOf.length +
            ')'
          )
        })
      }
    }
    if (options.nsfw === true || options.nsfw === false) {
      query.where[ 'nsfw' ] = options.nsfw
    }

    if (options.categoryOneOf) {
      query.where[ 'category' ] = {
        [ Sequelize.Op.or ]: options.categoryOneOf
      }
    }

    if (options.licenceOneOf) {
      query.where[ 'licence' ] = {
        [ Sequelize.Op.or ]: options.licenceOneOf
      }
    }

    if (options.languageOneOf) {
      query.where[ 'language' ] = {
        [ Sequelize.Op.or ]: options.languageOneOf
      }
    }

    if (options.trendingDays) {
      query.include.push(VideoModel.buildTrendingQuery(options.trendingDays))

      query.subQuery = false
    }

    return query
  },
  [ ScopeNames.WITH_ACCOUNT_DETAILS ]: {
    include: [
      {
        model: () => VideoChannelModel.unscoped(),
        required: true,
        include: [
          {
            attributes: {
              exclude: [ 'privateKey', 'publicKey' ]
            },
            model: () => ActorModel.unscoped(),
            required: true,
            include: [
              {
                attributes: [ 'host' ],
                model: () => ServerModel.unscoped(),
                required: false
              },
              {
                model: () => AvatarModel.unscoped(),
                required: false
              }
            ]
          },
          {
            model: () => AccountModel.unscoped(),
            required: true,
            include: [
              {
                model: () => ActorModel.unscoped(),
                attributes: {
                  exclude: [ 'privateKey', 'publicKey' ]
                },
                required: true,
                include: [
                  {
                    attributes: [ 'host' ],
                    model: () => ServerModel.unscoped(),
                    required: false
                  },
                  {
                    model: () => AvatarModel.unscoped(),
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
    include: [ () => TagModel ]
  },
  [ ScopeNames.WITH_AUTORS ]: {
    include: [ () => AutorModel ]
  },
  [ ScopeNames.WITH_BLACKLISTED ]: {
    include: [
      {
        attributes: [ 'id', 'reason' ],
        model: () => VideoBlacklistModel,
        required: false
      }
    ]
  },
  [ ScopeNames.WITH_FILES ]: {
    include: [
      {
        model: () => VideoFileModel.unscoped(),
        // FIXME: typings
        [ 'separate' as any ]: true, // We may have multiple files, having multiple redundancies so let's separate this join
        required: false,
        include: [
          {
            attributes: [ 'fileUrl' ],
            model: () => VideoRedundancyModel.unscoped(),
            required: false
          }
        ]
      }
    ]
  },
  [ ScopeNames.WITH_SCHEDULED_UPDATE ]: {
    include: [
      {
        model: () => ScheduleVideoUpdateModel.unscoped(),
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
})
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
  @Is('VideoCategory', value => throwIfNotValid(value, isVideoCategoryValid, 'category'))
  @Column
  category: number

    @AllowNull(true)
  @Default(null)
  @Is('VideoLicence', value => throwIfNotValid(value, isVideoLicenceValid, 'licence'))
  @Column
  licence: number

  @AllowNull(true)
  @Default(null)
  @Is('VideoLanguage', value => throwIfNotValid(value, isVideoLanguageValid, 'language'))
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
  @Is('VideoDescription', value => throwIfNotValid(value, isVideoDescriptionValid, 'description'))
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.VIDEOS.DESCRIPTION.max))
  description: string

  @AllowNull(true)
  @Default(null)
  @Is('VideoSupport', value => throwIfNotValid(value, isVideoSupportValid, 'support'))
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

  @AllowNull(true)
  @Is('VideoArticle', value => throwIfNotValid(value, isVideoArticleidValid, 'articleid'))
  @Column
  articleid: number

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
  @Default(Sequelize.NOW)
  @Column
  publishedAt: Date

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

  @BelongsToMany(() => AutorModel, {
    foreignKey: 'videoId',
    through: () => VideoAutorModel,
    onDelete: 'CASCADE'
  })
  Autors: AutorModel[]

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
  static async sendDelete (instance: VideoModel, options) {
    if (instance.isOwned()) {
      if (!instance.VideoChannel) {
        instance.VideoChannel = await instance.$get('VideoChannel', {
          include: [
            {
              model: AccountModel,
              include: [ ActorModel ]
            }
          ],
          transaction: options.transaction
        }) as VideoChannelModel
      }

      return sendDeleteVideo(instance, options.transaction)
    }

    return undefined
  }

  @BeforeDestroy
  static async removeFiles (instance: VideoModel) {
    const tasks: Promise<any>[] = []

    logger.info('Removing files of video %s.', instance.url)

    tasks.push(instance.removeThumbnail())

    if (instance.isOwned()) {
      if (!Array.isArray(instance.VideoFiles)) {
        instance.VideoFiles = await instance.$get('VideoFiles') as VideoFileModel[]
      }

      tasks.push(instance.removePreview())

      // Remove physical files and torrents
      instance.VideoFiles.forEach(file => {
        tasks.push(instance.removeFile(file))
        tasks.push(instance.removeTorrent(file))
      })
    }

    // Do not wait video deletion because we could be in a transaction
    Promise.all(tasks)
           .catch(err => {
             logger.error('Some errors when removing files of video %s in before destroy hook.', instance.uuid, { err })
           })

    return undefined
  }

  static list () {
    return VideoModel.scope(ScopeNames.WITH_FILES).findAll()
  }

  static listLocal () {
    const query = {
      where: {
        remote: false
      }
    }

    return VideoModel.scope(ScopeNames.WITH_FILES).findAll(query)
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
      order: getVideoSort('createdAt', [ 'Tags', 'name', 'ASC' ]),
      where: {
        id: {
          [ Sequelize.Op.in ]: Sequelize.literal('(' + rawQuery + ')')
        },
        [ Sequelize.Op.or ]: [
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
            [ Sequelize.Op.and ]: [
              {
                id: {
                  [ Sequelize.Op.not ]: null
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
        TagModel,
        AutorModel
      ]
    }

    return Bluebird.all([
      // FIXME: typing issue
      VideoModel.findAll(query as any),
      VideoModel.sequelize.query(rawCountQuery, { type: Sequelize.QueryTypes.SELECT })
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

  static listUserVideosForApi (accountId: number, start: number, count: number, sort: string, withFiles = false) {
    const query: IFindOptions<VideoModel> = {
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
        },
        {
          model: ScheduleVideoUpdateModel,
          required: false
        },
        {
          model: VideoBlacklistModel,
          required: false
        }
      ]
    }

    if (withFiles === true) {
      query.include.push({
        model: VideoFileModel.unscoped(),
        required: true
      })
    }

    return VideoModel.findAndCountAll(query).then(({ rows, count }) => {
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
    autorsOneOf?: string[],
    autorsAllOf?: string[],
    filter?: VideoFilter,
    accountId?: number,
    videoChannelId?: number,
    actorId?: number
    trendingDays?: number,
    user?: UserModel
  }, countVideos = true) {
    if (options.filter && options.filter === 'all-local' && !options.user.hasRight(UserRight.SEE_ALL_VIDEOS)) {
      throw new Error('Try to filter all-local but no user has not the see all videos right')
    }

    const query: IFindOptions<VideoModel> = {
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

    // actorId === null has a meaning, so just check undefined
    const actorId = options.actorId !== undefined ? options.actorId : serverActor.id

    const queryOptions = {
      actorId,
      serverAccountId: serverActor.Account.id,
      nsfw: options.nsfw,
      categoryOneOf: options.categoryOneOf,
      licenceOneOf: options.licenceOneOf,
      languageOneOf: options.languageOneOf,
      tagsOneOf: options.tagsOneOf,
      tagsAllOf: options.tagsAllOf,
      autorsOneOf: options.autorsOneOf,
      autorsAllOf: options.autorsAllOf,
      filter: options.filter,
      withFiles: options.withFiles,
      accountId: options.accountId,
      videoChannelId: options.videoChannelId,
      includeLocalVideos: options.includeLocalVideos,
      user: options.user,
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
    nsfw?: boolean
    categoryOneOf?: number[]
    licenceOneOf?: number[]
    languageOneOf?: string[]
    tagsOneOf?: string[]
    tagsAllOf?: string[]
    autorsOneOf?: string[]
    autorsAllOf?: string[]
    durationMin?: number // seconds
    durationMax?: number // seconds
    user?: UserModel,
    filter?: VideoFilter
  }) {
    const whereAnd = []

    if (options.startDate || options.endDate) {
      const publishedAtRange = {}

      if (options.startDate) publishedAtRange[ Sequelize.Op.gte ] = options.startDate
      if (options.endDate) publishedAtRange[ Sequelize.Op.lte ] = options.endDate

      whereAnd.push({ publishedAt: publishedAtRange })
    }

    if (options.durationMin || options.durationMax) {
      const durationRange = {}

      if (options.durationMin) durationRange[ Sequelize.Op.gte ] = options.durationMin
      if (options.durationMax) durationRange[ Sequelize.Op.lte ] = options.durationMax

      whereAnd.push({ duration: durationRange })
    }

    const attributesInclude = []
    const escapedSearch = VideoModel.sequelize.escape(options.search)
    const escapedLikeSearch = VideoModel.sequelize.escape('%' + options.search + '%')
    if (options.search) {
      whereAnd.push(
        {
          id: {
            [ Sequelize.Op.in ]: Sequelize.literal(
              '(' +
              'SELECT "video"."id" FROM "video" ' +
              'WHERE ' +
              'lower(immutable_unaccent("video"."name")) % lower(immutable_unaccent(' + escapedSearch + ')) OR ' +
              'lower(immutable_unaccent("video"."name")) LIKE lower(immutable_unaccent(' + escapedLikeSearch + '))' +
              'UNION ALL ' +
              'SELECT "video"."id" FROM "video" LEFT JOIN "videoTag" ON "videoTag"."videoId" = "video"."id" ' +
              'INNER JOIN "tag" ON "tag"."id" = "videoTag"."tagId" ' +
              'WHERE "tag"."name" = ' + escapedSearch + 
              'UNION ALL ' +
              'SELECT "video"."id" FROM "video" LEFT JOIN "videoAutor" ON "videoAutor"."videoId" = "video"."id" ' +
              'INNER JOIN "autor" ON "autor"."id" = "videoAutor"."autorId" ' +
              'WHERE "autor"."name" = ' + escapedSearch +
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

    const query: IFindOptions<VideoModel> = {
      attributes: {
        include: attributesInclude
      },
      offset: options.start,
      limit: options.count,
      order: getVideoSort(options.sort),
      where: {
        [ Sequelize.Op.and ]: whereAnd
      }
    }

    const serverActor = await getServerActor()
    const queryOptions = {
      actorId: serverActor.id,
      serverAccountId: serverActor.Account.id,
      includeLocalVideos: options.includeLocalVideos,
      nsfw: options.nsfw,
      categoryOneOf: options.categoryOneOf,
      licenceOneOf: options.licenceOneOf,
      languageOneOf: options.languageOneOf,
      tagsOneOf: options.tagsOneOf,
      tagsAllOf: options.tagsAllOf,
      autorsOneOf: options.autorsOneOf,
      autorsAllOf: options.autorsAllOf,
      user: options.user,
      filter: options.filter
    }

    return VideoModel.getAvailableForApi(query, queryOptions)
  }

  static load (id: number | string, t?: Sequelize.Transaction) {
    const where = VideoModel.buildWhereIdOrUUID(id)
    const options = {
      where,
      transaction: t
    }

    return VideoModel.findOne(options)
  }

  static loadOnlyId (id: number | string, t?: Sequelize.Transaction) {
    const where = VideoModel.buildWhereIdOrUUID(id)

    const options = {
      attributes: [ 'id' ],
      where,
      transaction: t
    }

    return VideoModel.findOne(options)
  }

  static loadWithFile (id: number, t?: Sequelize.Transaction, logging?: boolean) {
    return VideoModel.scope(ScopeNames.WITH_FILES)
                     .findById(id, { transaction: t, logging })
  }

  static loadByUUIDWithFile (uuid: string) {
    const options = {
      where: {
        uuid
      }
    }

    return VideoModel
      .scope([ ScopeNames.WITH_FILES ])
      .findOne(options)
  }

  static loadByUrl (url: string, transaction?: Sequelize.Transaction) {
    const query: IFindOptions<VideoModel> = {
      where: {
        url
      },
      transaction
    }

    return VideoModel.findOne(query)
  }

  static loadByUrlAndPopulateAccount (url: string, transaction?: Sequelize.Transaction) {
    const query: IFindOptions<VideoModel> = {
      where: {
        url
      },
      transaction
    }

    return VideoModel.scope([ ScopeNames.WITH_ACCOUNT_DETAILS, ScopeNames.WITH_FILES ]).findOne(query)
  }

  static loadAndPopulateAccountAndServerAndTags (id: number | string, t?: Sequelize.Transaction, userId?: number) {
    const where = VideoModel.buildWhereIdOrUUID(id)

    const options = {
      order: [ [ 'Tags', 'name', 'ASC' ] ],
      where,
      transaction: t
    }

    const scopes = [
      ScopeNames.WITH_TAGS,
      ScopeNames.WITH_AUTORS,
      ScopeNames.WITH_BLACKLISTED,
      ScopeNames.WITH_FILES,
      ScopeNames.WITH_ACCOUNT_DETAILS,
      ScopeNames.WITH_SCHEDULED_UPDATE
    ]

    if (userId) {
      scopes.push({ method: [ ScopeNames.WITH_USER_HISTORY, userId ] } as any) // FIXME: typings
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

  // threshold corresponds to how many video the field should have to be returned
  static async getRandomFieldSamples (field: 'category' | 'channelId', threshold: number, count: number) {
    const serverActor = await getServerActor()
    const actorId = serverActor.id

    const scopeOptions: AvailableForListIDsOptions = {
      serverAccountId: serverActor.Account.id,
      actorId,
      includeLocalVideos: true
    }

    const query: IFindOptions<VideoModel> = {
      attributes: [ field ],
      limit: count,
      group: field,
      having: Sequelize.where(Sequelize.fn('COUNT', Sequelize.col(field)), {
        [ Sequelize.Op.gte ]: threshold
      }) as any, // FIXME: typings
      order: [ this.sequelize.random() ]
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
          [ Sequelize.Op.gte ]: new Date(new Date().getTime() - (24 * 3600 * 1000) * trendingDays)
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
    query: IFindOptions<VideoModel>,
    options: AvailableForListIDsOptions,
    countVideos = true
  ) {
    const idsScope = {
      method: [
        ScopeNames.AVAILABLE_FOR_LIST_IDS, options
      ]
    }

    // Remove trending sort on count, because it uses a group by
    const countOptions = Object.assign({}, options, { trendingDays: undefined })
    const countQuery = Object.assign({}, query, { attributes: undefined, group: undefined })
    const countScope = {
      method: [
        ScopeNames.AVAILABLE_FOR_LIST_IDS, countOptions
      ]
    }

    const [ count, rowsId ] = await Promise.all([
      countVideos ? VideoModel.scope(countScope).count(countQuery) : Promise.resolve(undefined),
      VideoModel.scope(idsScope).findAll(query)
    ])
    const ids = rowsId.map(r => r.id)

    if (ids.length === 0) return { data: [], total: count }

    // FIXME: typings
    const apiScope: any[] = [
      {
        method: [ ScopeNames.FOR_API, { ids, withFiles: options.withFiles } as ForAPIOptions ]
      }
    ]

    if (options.user) {
      apiScope.push({ method: [ ScopeNames.WITH_USER_HISTORY, options.user.id ] })
    }

    const secondQuery = {
      offset: 0,
      limit: query.limit,
      attributes: query.attributes,
      order: [ // Keep original order
        Sequelize.literal(
          ids.map(id => `"VideoModel".id = ${id} DESC`).join(', ')
        )
      ]
    }
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

  static buildWhereIdOrUUID (id: number | string) {
    return validator.isInt('' + id) ? { id } : { uuid: id }
  }

  getOriginalFile () {
    if (Array.isArray(this.VideoFiles) === false) return undefined

    // The original file is the file that have the higher resolution
    return maxBy(this.VideoFiles, file => file.resolution)
  }

  getVideoFilename (videoFile: VideoFileModel) {
    return this.uuid + '-' + videoFile.resolution + videoFile.extname
  }

  getThumbnailName () {
    // We always have a copy of the thumbnail
    const extension = '.jpg'
    return this.uuid + extension
  }

  getPreviewName () {
    const extension = '.jpg'
    return this.uuid + extension
  }

  getTorrentFileName (videoFile: VideoFileModel) {
    const extension = '.torrent'
    return this.uuid + '-' + videoFile.resolution + extension
  }

  isOwned () {
    return this.remote === false
  }

  createPreview (videoFile: VideoFileModel) {
    return generateImageFromVideoFile(
      this.getVideoFilePath(videoFile),
      CONFIG.STORAGE.PREVIEWS_DIR,
      this.getPreviewName(),
      PREVIEWS_SIZE
    )
  }

  createThumbnail (videoFile: VideoFileModel) {
    return generateImageFromVideoFile(
      this.getVideoFilePath(videoFile),
      CONFIG.STORAGE.THUMBNAILS_DIR,
      this.getThumbnailName(),
      THUMBNAILS_SIZE
    )
  }

  getTorrentFilePath (videoFile: VideoFileModel) {
    return join(CONFIG.STORAGE.TORRENTS_DIR, this.getTorrentFileName(videoFile))
  }

  getVideoFilePath (videoFile: VideoFileModel) {
    return join(CONFIG.STORAGE.VIDEOS_DIR, this.getVideoFilename(videoFile))
  }

  async createTorrentAndSetInfoHash (videoFile: VideoFileModel) {
    const options = {
      // Keep the extname, it's used by the client to stream the file inside a web browser
      name: `${this.name} ${videoFile.resolution}p${videoFile.extname}`,
      createdBy: 'PeerTube',
      announceList: [
        [ CONFIG.WEBSERVER.WS + '://' + CONFIG.WEBSERVER.HOSTNAME + ':' + CONFIG.WEBSERVER.PORT + '/tracker/socket' ],
        [ CONFIG.WEBSERVER.URL + '/tracker/announce' ]
      ],
      urlList: [ CONFIG.WEBSERVER.URL + STATIC_PATHS.WEBSEED + this.getVideoFilename(videoFile) ]
    }

    const torrent = await createTorrentPromise(this.getVideoFilePath(videoFile), options)

    const filePath = join(CONFIG.STORAGE.TORRENTS_DIR, this.getTorrentFileName(videoFile))
    logger.info('Creating torrent %s.', filePath)

    await writeFile(filePath, torrent)

    const parsedTorrent = parseTorrent(torrent)
    videoFile.infoHash = parsedTorrent.infoHash
  }

  getEmbedStaticPath () {
    return '/videos/embed/' + this.uuid
  }

  getThumbnailStaticPath () {
    return join(STATIC_PATHS.THUMBNAILS, this.getThumbnailName())
  }

  getPreviewStaticPath () {
    return join(STATIC_PATHS.PREVIEWS, this.getPreviewName())
  }

  toFormattedJSON (options?: VideoFormattingJSONOptions): Video {
    return videoModelToFormattedJSON(this, options)
  }

  toFormattedDetailsJSON (): VideoDetails {
    return videoModelToFormattedDetailsJSON(this)
  }

  getFormattedVideoFilesJSON (): VideoFile[] {
    return videoFilesModelToFormattedJSON(this, this.VideoFiles)
  }

  toActivityPubObject (): VideoTorrentObject {
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

  removeThumbnail () {
    const thumbnailPath = join(CONFIG.STORAGE.THUMBNAILS_DIR, this.getThumbnailName())
    return remove(thumbnailPath)
      .catch(err => logger.warn('Cannot delete thumbnail %s.', thumbnailPath, { err }))
  }

  removePreview () {
    const previewPath = join(CONFIG.STORAGE.PREVIEWS_DIR + this.getPreviewName())
    return remove(previewPath)
      .catch(err => logger.warn('Cannot delete preview %s.', previewPath, { err }))
  }

  removeFile (videoFile: VideoFileModel) {
    const filePath = join(CONFIG.STORAGE.VIDEOS_DIR, this.getVideoFilename(videoFile))
    return remove(filePath)
      .catch(err => logger.warn('Cannot delete file %s.', filePath, { err }))
  }

  removeTorrent (videoFile: VideoFileModel) {
    const torrentPath = join(CONFIG.STORAGE.TORRENTS_DIR, this.getTorrentFileName(videoFile))
    return remove(torrentPath)
      .catch(err => logger.warn('Cannot delete torrent %s.', torrentPath, { err }))
  }

  isOutdated () {
    if (this.isOwned()) return false

    const now = Date.now()
    const createdAtTime = this.createdAt.getTime()
    const updatedAtTime = this.updatedAt.getTime()

    return (now - createdAtTime) > ACTIVITY_PUB.VIDEO_REFRESH_INTERVAL &&
      (now - updatedAtTime) > ACTIVITY_PUB.VIDEO_REFRESH_INTERVAL
  }

  getBaseUrls () {
    let baseUrlHttp
    let baseUrlWs

    if (this.isOwned()) {
      baseUrlHttp = CONFIG.WEBSERVER.URL
      baseUrlWs = CONFIG.WEBSERVER.WS + '://' + CONFIG.WEBSERVER.HOSTNAME + ':' + CONFIG.WEBSERVER.PORT
    } else {
      baseUrlHttp = REMOTE_SCHEME.HTTP + '://' + this.VideoChannel.Account.Actor.Server.host
      baseUrlWs = REMOTE_SCHEME.WS + '://' + this.VideoChannel.Account.Actor.Server.host
    }

    return { baseUrlHttp, baseUrlWs }
  }

  generateMagnetUri (videoFile: VideoFileModel, baseUrlHttp: string, baseUrlWs: string) {
    const xs = this.getTorrentUrl(videoFile, baseUrlHttp)
    const announce = [ baseUrlWs + '/tracker/socket', baseUrlHttp + '/tracker/announce' ]
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

  getThumbnailUrl (baseUrlHttp: string) {
    return baseUrlHttp + STATIC_PATHS.THUMBNAILS + this.getThumbnailName()
  }

  getTorrentUrl (videoFile: VideoFileModel, baseUrlHttp: string) {
    return baseUrlHttp + STATIC_PATHS.TORRENTS + this.getTorrentFileName(videoFile)
  }

  getTorrentDownloadUrl (videoFile: VideoFileModel, baseUrlHttp: string) {
    return baseUrlHttp + STATIC_DOWNLOAD_PATHS.TORRENTS + this.getTorrentFileName(videoFile)
  }

  getVideoFileUrl (videoFile: VideoFileModel, baseUrlHttp: string) {
    return baseUrlHttp + STATIC_PATHS.WEBSEED + this.getVideoFilename(videoFile)
  }

  getVideoFileDownloadUrl (videoFile: VideoFileModel, baseUrlHttp: string) {
    return baseUrlHttp + STATIC_DOWNLOAD_PATHS.VIDEOS + this.getVideoFilename(videoFile)
  }
}
