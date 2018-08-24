import * as Bluebird from 'bluebird'
import { map, maxBy } from 'lodash'
import * as magnetUtil from 'magnet-uri'
import * as parseTorrent from 'parse-torrent'
import { extname, join } from 'path'
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
  Is,
  IsInt,
  IsUUID,
  Min,
  Model,
  Scopes,
  Table,
  UpdatedAt
} from 'sequelize-typescript'
import { VideoPrivacy, VideoResolution, VideoState } from '../../../shared'
import { VideoTorrentObject } from '../../../shared/models/activitypub/objects'
import { Video, VideoDetails, VideoFile } from '../../../shared/models/videos'
import { VideoFilter } from '../../../shared/models/videos/video-query.type'
import {
  copyFilePromise,
  createTorrentPromise,
  peertubeTruncate,
  renamePromise,
  statPromise,
  unlinkPromise,
  writeFilePromise
} from '../../helpers/core-utils'
import { isActivityPubUrlValid } from '../../helpers/custom-validators/activitypub/misc'
import { isBooleanValid } from '../../helpers/custom-validators/misc'
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
import { generateImageFromVideoFile, getVideoFileFPS, getVideoFileResolution, transcode } from '../../helpers/ffmpeg-utils'
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
  VIDEO_EXT_MIMETYPE,
  VIDEO_LANGUAGES,
  VIDEO_LICENCES,
  VIDEO_PRIVACIES,
  VIDEO_STATES
} from '../../initializers'
import {
  getVideoCommentsActivityPubUrl,
  getVideoDislikesActivityPubUrl,
  getVideoLikesActivityPubUrl,
  getVideoSharesActivityPubUrl
} from '../../lib/activitypub'
import { sendDeleteVideo } from '../../lib/activitypub/send'
import { AccountModel } from '../account/account'
import { AccountVideoRateModel } from '../account/account-video-rate'
import { ActorModel } from '../activitypub/actor'
import { AvatarModel } from '../avatar/avatar'
import { ServerModel } from '../server/server'
import { buildTrigramSearchIndex, createSimilarityAttribute, getSort, throwIfNotValid } from '../utils'
import { TagModel } from './tag'
import { VideoAbuseModel } from './video-abuse'
import { VideoChannelModel } from './video-channel'
import { VideoCommentModel } from './video-comment'
import { VideoFileModel } from './video-file'
import { VideoShareModel } from './video-share'
import { VideoTagModel } from './video-tag'
import { ScheduleVideoUpdateModel } from './schedule-video-update'
import { VideoCaptionModel } from './video-caption'
import { VideoBlacklistModel } from './video-blacklist'

// FIXME: Define indexes here because there is an issue with TS and Sequelize.literal when called directly in the annotation
const indexes: Sequelize.DefineIndexesOptions[] = [
  buildTrigramSearchIndex('video_name_trigram', 'name'),

  { fields: [ 'createdAt' ] },
  { fields: [ 'publishedAt' ] },
  { fields: [ 'duration' ] },
  { fields: [ 'category' ] },
  { fields: [ 'licence' ] },
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
    fields: [ 'url'],
    unique: true
  }
]

export enum ScopeNames {
  AVAILABLE_FOR_LIST = 'AVAILABLE_FOR_LIST',
  WITH_ACCOUNT_DETAILS = 'WITH_ACCOUNT_DETAILS',
  WITH_TAGS = 'WITH_TAGS',
  WITH_FILES = 'WITH_FILES',
  WITH_SCHEDULED_UPDATE = 'WITH_SCHEDULED_UPDATE',
  WITH_BLACKLISTED = 'WITH_BLACKLISTED'
}

type AvailableForListOptions = {
  actorId: number,
  includeLocalVideos: boolean,
  filter?: VideoFilter,
  categoryOneOf?: number[],
  nsfw?: boolean,
  licenceOneOf?: number[],
  languageOneOf?: string[],
  tagsOneOf?: string[],
  tagsAllOf?: string[],
  withFiles?: boolean,
  accountId?: number,
  videoChannelId?: number
}

@Scopes({
  [ScopeNames.AVAILABLE_FOR_LIST]: (options: AvailableForListOptions) => {
    const accountInclude = {
      attributes: [ 'id', 'name' ],
      model: AccountModel.unscoped(),
      required: true,
      where: {},
      include: [
        {
          attributes: [ 'id', 'uuid', 'preferredUsername', 'url', 'serverId', 'avatarId' ],
          model: ActorModel.unscoped(),
          required: true,
          where: VideoModel.buildActorWhereWithFilter(options.filter),
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
      where: {},
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

    // FIXME: It would be more efficient to use a CTE so we join AFTER the filters, but sequelize does not support it...
    const query: IFindOptions<VideoModel> = {
      where: {
        id: {
          [Sequelize.Op.notIn]: Sequelize.literal(
            '(SELECT "videoBlacklist"."videoId" FROM "videoBlacklist")'
          )
        },
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
      },
      include: [ videoChannelInclude ]
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
      query.where['id'][ Sequelize.Op.in ] = Sequelize.literal(
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

    if (options.withFiles === true) {
      query.include.push({
        model: VideoFileModel.unscoped(),
        required: true
      })
    }

    // FIXME: issues with sequelize count when making a join on n:m relation, so we just make a IN()
    if (options.tagsAllOf || options.tagsOneOf) {
      const createTagsIn = (tags: string[]) => {
        return tags.map(t => VideoModel.sequelize.escape(t))
                   .join(', ')
      }

      if (options.tagsOneOf) {
        query.where['id'][Sequelize.Op.in] = Sequelize.literal(
          '(' +
            'SELECT "videoId" FROM "videoTag" ' +
            'INNER JOIN "tag" ON "tag"."id" = "videoTag"."tagId" ' +
            'WHERE "tag"."name" IN (' + createTagsIn(options.tagsOneOf) + ')' +
          ')'
        )
      }

      if (options.tagsAllOf) {
        query.where['id'][Sequelize.Op.in] = Sequelize.literal(
            '(' +
              'SELECT "videoId" FROM "videoTag" ' +
              'INNER JOIN "tag" ON "tag"."id" = "videoTag"."tagId" ' +
              'WHERE "tag"."name" IN (' + createTagsIn(options.tagsAllOf) + ')' +
              'GROUP BY "videoTag"."videoId" HAVING COUNT(*) = ' + options.tagsAllOf.length +
            ')'
        )
      }
    }

    if (options.nsfw === true || options.nsfw === false) {
      query.where['nsfw'] = options.nsfw
    }

    if (options.categoryOneOf) {
      query.where['category'] = {
        [Sequelize.Op.or]: options.categoryOneOf
      }
    }

    if (options.licenceOneOf) {
      query.where['licence'] = {
        [Sequelize.Op.or]: options.licenceOneOf
      }
    }

    if (options.languageOneOf) {
      query.where['language'] = {
        [Sequelize.Op.or]: options.languageOneOf
      }
    }

    if (options.accountId) {
      accountInclude.where = {
        id: options.accountId
      }
    }

    if (options.videoChannelId) {
      videoChannelInclude.where = {
        id: options.videoChannelId
      }
    }

    return query
  },
  [ScopeNames.WITH_ACCOUNT_DETAILS]: {
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
  [ScopeNames.WITH_TAGS]: {
    include: [ () => TagModel ]
  },
  [ScopeNames.WITH_BLACKLISTED]: {
    include: [
      {
        attributes: [ 'id', 'reason' ],
        model: () => VideoBlacklistModel,
        required: false
      }
    ]
  },
  [ScopeNames.WITH_FILES]: {
    include: [
      {
        model: () => VideoFileModel.unscoped(),
        required: false
      }
    ]
  },
  [ScopeNames.WITH_SCHEDULED_UPDATE]: {
    include: [
      {
        model: () => ScheduleVideoUpdateModel.unscoped(),
        required: false
      }
    ]
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
    ['separate' as any]: true
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
      order: getSort('createdAt', [ 'Tags', 'name', 'ASC' ]),
      where: {
        id: {
          [Sequelize.Op.in]: Sequelize.literal('(' + rawQuery + ')')
        },
        [Sequelize.Op.or]: [
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
            [Sequelize.Op.and]: [
              {
                id: {
                  [Sequelize.Op.not]: null
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
      // FIXME: typing issue
      VideoModel.findAll(query as any),
      VideoModel.sequelize.query(rawCountQuery, { type: Sequelize.QueryTypes.SELECT })
    ]).then(([ rows, totals ]) => {
      // totals: totalVideos + totalVideoShares
      let totalVideos = 0
      let totalVideoShares = 0
      if (totals[0]) totalVideos = parseInt(totals[0].total, 10)
      if (totals[1]) totalVideoShares = parseInt(totals[1].total, 10)

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
      order: getSort(sort),
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
    filter?: VideoFilter,
    accountId?: number,
    videoChannelId?: number,
    actorId?: number
  }) {
    const query = {
      offset: options.start,
      limit: options.count,
      order: getSort(options.sort)
    }

    // actorId === null has a meaning, so just check undefined
    const actorId = options.actorId !== undefined ? options.actorId : (await getServerActor()).id

    const scopes = {
      method: [
        ScopeNames.AVAILABLE_FOR_LIST, {
          actorId,
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
          includeLocalVideos: options.includeLocalVideos
        } as AvailableForListOptions
      ]
    }

    return VideoModel.scope(scopes)
      .findAndCountAll(query)
      .then(({ rows, count }) => {
        return {
          data: rows,
          total: count
        }
      })
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
    durationMin?: number // seconds
    durationMax?: number // seconds
  }) {
    const whereAnd = [ ]

    if (options.startDate || options.endDate) {
      const publishedAtRange = { }

      if (options.startDate) publishedAtRange[Sequelize.Op.gte] = options.startDate
      if (options.endDate) publishedAtRange[Sequelize.Op.lte] = options.endDate

      whereAnd.push({ publishedAt: publishedAtRange })
    }

    if (options.durationMin || options.durationMax) {
      const durationRange = { }

      if (options.durationMin) durationRange[Sequelize.Op.gte] = options.durationMin
      if (options.durationMax) durationRange[Sequelize.Op.lte] = options.durationMax

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
      order: getSort(options.sort),
      where: {
        [ Sequelize.Op.and ]: whereAnd
      }
    }

    const serverActor = await getServerActor()
    const scopes = {
      method: [
        ScopeNames.AVAILABLE_FOR_LIST, {
          actorId: serverActor.id,
          includeLocalVideos: options.includeLocalVideos,
          nsfw: options.nsfw,
          categoryOneOf: options.categoryOneOf,
          licenceOneOf: options.licenceOneOf,
          languageOneOf: options.languageOneOf,
          tagsOneOf: options.tagsOneOf,
          tagsAllOf: options.tagsAllOf
        } as AvailableForListOptions
      ]
    }

    return VideoModel.scope(scopes)
      .findAndCountAll(query)
      .then(({ rows, count }) => {
        return {
          data: rows,
          total: count
        }
      })
  }

  static load (id: number, t?: Sequelize.Transaction) {
    const options = t ? { transaction: t } : undefined

    return VideoModel.findById(id, options)
  }

  static loadByUrlAndPopulateAccount (url: string, t?: Sequelize.Transaction) {
    const query: IFindOptions<VideoModel> = {
      where: {
        url
      }
    }

    if (t !== undefined) query.transaction = t

    return VideoModel.scope([ ScopeNames.WITH_ACCOUNT_DETAILS, ScopeNames.WITH_FILES ]).findOne(query)
  }

  static loadAndPopulateAccountAndServerAndTags (id: number) {
    const options = {
      order: [ [ 'Tags', 'name', 'ASC' ] ]
    }

    return VideoModel
      .scope([
        ScopeNames.WITH_TAGS,
        ScopeNames.WITH_BLACKLISTED,
        ScopeNames.WITH_FILES,
        ScopeNames.WITH_ACCOUNT_DETAILS,
        ScopeNames.WITH_SCHEDULED_UPDATE
      ])
      .findById(id, options)
  }

  static loadByUUID (uuid: string) {
    const options = {
      where: {
        uuid
      }
    }

    return VideoModel
      .scope([ ScopeNames.WITH_FILES ])
      .findOne(options)
  }

  static loadByUUIDAndPopulateAccountAndServerAndTags (uuid: string, t?: Sequelize.Transaction) {
    const options = {
      order: [ [ 'Tags', 'name', 'ASC' ] ],
      where: {
        uuid
      },
      transaction: t
    }

    return VideoModel
      .scope([
        ScopeNames.WITH_TAGS,
        ScopeNames.WITH_BLACKLISTED,
        ScopeNames.WITH_FILES,
        ScopeNames.WITH_ACCOUNT_DETAILS,
        ScopeNames.WITH_SCHEDULED_UPDATE
      ])
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

  private static buildActorWhereWithFilter (filter?: VideoFilter) {
    if (filter && filter === 'local') {
      return {
        serverId: null
      }
    }

    return {}
  }

  private static getCategoryLabel (id: number) {
    return VIDEO_CATEGORIES[id] || 'Misc'
  }

  private static getLicenceLabel (id: number) {
    return VIDEO_LICENCES[id] || 'Unknown'
  }

  private static getLanguageLabel (id: string) {
    return VIDEO_LANGUAGES[id] || 'Unknown'
  }

  private static getPrivacyLabel (id: number) {
    return VIDEO_PRIVACIES[id] || 'Unknown'
  }

  private static getStateLabel (id: number) {
    return VIDEO_STATES[id] || 'Unknown'
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
      urlList: [
        CONFIG.WEBSERVER.URL + STATIC_PATHS.WEBSEED + this.getVideoFilename(videoFile)
      ]
    }

    const torrent = await createTorrentPromise(this.getVideoFilePath(videoFile), options)

    const filePath = join(CONFIG.STORAGE.TORRENTS_DIR, this.getTorrentFileName(videoFile))
    logger.info('Creating torrent %s.', filePath)

    await writeFilePromise(filePath, torrent)

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

  toFormattedJSON (options?: {
    additionalAttributes: {
      state?: boolean,
      waitTranscoding?: boolean,
      scheduledUpdate?: boolean,
      blacklistInfo?: boolean
    }
  }): Video {
    const formattedAccount = this.VideoChannel.Account.toFormattedJSON()
    const formattedVideoChannel = this.VideoChannel.toFormattedJSON()

    const videoObject: Video = {
      id: this.id,
      uuid: this.uuid,
      name: this.name,
      category: {
        id: this.category,
        label: VideoModel.getCategoryLabel(this.category)
      },
      licence: {
        id: this.licence,
        label: VideoModel.getLicenceLabel(this.licence)
      },
      language: {
        id: this.language,
        label: VideoModel.getLanguageLabel(this.language)
      },
      privacy: {
        id: this.privacy,
        label: VideoModel.getPrivacyLabel(this.privacy)
      },
      nsfw: this.nsfw,
      description: this.getTruncatedDescription(),
      isLocal: this.isOwned(),
      duration: this.duration,
      views: this.views,
      likes: this.likes,
      dislikes: this.dislikes,
      thumbnailPath: this.getThumbnailStaticPath(),
      previewPath: this.getPreviewStaticPath(),
      embedPath: this.getEmbedStaticPath(),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      publishedAt: this.publishedAt,
      account: {
        id: formattedAccount.id,
        uuid: formattedAccount.uuid,
        name: formattedAccount.name,
        displayName: formattedAccount.displayName,
        url: formattedAccount.url,
        host: formattedAccount.host,
        avatar: formattedAccount.avatar
      },
      channel: {
        id: formattedVideoChannel.id,
        uuid: formattedVideoChannel.uuid,
        name: formattedVideoChannel.name,
        displayName: formattedVideoChannel.displayName,
        url: formattedVideoChannel.url,
        host: formattedVideoChannel.host,
        avatar: formattedVideoChannel.avatar
      }
    }

    if (options) {
      if (options.additionalAttributes.state === true) {
        videoObject.state = {
          id: this.state,
          label: VideoModel.getStateLabel(this.state)
        }
      }

      if (options.additionalAttributes.waitTranscoding === true) {
        videoObject.waitTranscoding = this.waitTranscoding
      }

      if (options.additionalAttributes.scheduledUpdate === true && this.ScheduleVideoUpdate) {
        videoObject.scheduledUpdate = {
          updateAt: this.ScheduleVideoUpdate.updateAt,
          privacy: this.ScheduleVideoUpdate.privacy || undefined
        }
      }

      if (options.additionalAttributes.blacklistInfo === true) {
        videoObject.blacklisted = !!this.VideoBlacklist
        videoObject.blacklistedReason = this.VideoBlacklist ? this.VideoBlacklist.reason : null
      }
    }

    return videoObject
  }

  toFormattedDetailsJSON (): VideoDetails {
    const formattedJson = this.toFormattedJSON({
      additionalAttributes: {
        scheduledUpdate: true,
        blacklistInfo: true
      }
    })

    const detailsJson = {
      support: this.support,
      descriptionPath: this.getDescriptionPath(),
      channel: this.VideoChannel.toFormattedJSON(),
      account: this.VideoChannel.Account.toFormattedJSON(),
      tags: map(this.Tags, 'name'),
      commentsEnabled: this.commentsEnabled,
      waitTranscoding: this.waitTranscoding,
      state: {
        id: this.state,
        label: VideoModel.getStateLabel(this.state)
      },
      files: []
    }

    // Format and sort video files
    detailsJson.files = this.getFormattedVideoFilesJSON()

    return Object.assign(formattedJson, detailsJson)
  }

  getFormattedVideoFilesJSON (): VideoFile[] {
    const { baseUrlHttp, baseUrlWs } = this.getBaseUrls()

    return this.VideoFiles
        .map(videoFile => {
          let resolutionLabel = videoFile.resolution + 'p'

          return {
            resolution: {
              id: videoFile.resolution,
              label: resolutionLabel
            },
            magnetUri: this.generateMagnetUri(videoFile, baseUrlHttp, baseUrlWs),
            size: videoFile.size,
            fps: videoFile.fps,
            torrentUrl: this.getTorrentUrl(videoFile, baseUrlHttp),
            torrentDownloadUrl: this.getTorrentDownloadUrl(videoFile, baseUrlHttp),
            fileUrl: this.getVideoFileUrl(videoFile, baseUrlHttp),
            fileDownloadUrl: this.getVideoFileDownloadUrl(videoFile, baseUrlHttp)
          } as VideoFile
        })
        .sort((a, b) => {
          if (a.resolution.id < b.resolution.id) return 1
          if (a.resolution.id === b.resolution.id) return 0
          return -1
        })
  }

  toActivityPubObject (): VideoTorrentObject {
    const { baseUrlHttp, baseUrlWs } = this.getBaseUrls()
    if (!this.Tags) this.Tags = []

    const tag = this.Tags.map(t => ({
      type: 'Hashtag' as 'Hashtag',
      name: t.name
    }))

    let language
    if (this.language) {
      language = {
        identifier: this.language,
        name: VideoModel.getLanguageLabel(this.language)
      }
    }

    let category
    if (this.category) {
      category = {
        identifier: this.category + '',
        name: VideoModel.getCategoryLabel(this.category)
      }
    }

    let licence
    if (this.licence) {
      licence = {
        identifier: this.licence + '',
        name: VideoModel.getLicenceLabel(this.licence)
      }
    }

    const url = []
    for (const file of this.VideoFiles) {
      url.push({
        type: 'Link',
        mimeType: VIDEO_EXT_MIMETYPE[file.extname],
        href: this.getVideoFileUrl(file, baseUrlHttp),
        height: file.resolution,
        size: file.size,
        fps: file.fps
      })

      url.push({
        type: 'Link',
        mimeType: 'application/x-bittorrent',
        href: this.getTorrentUrl(file, baseUrlHttp),
        height: file.resolution
      })

      url.push({
        type: 'Link',
        mimeType: 'application/x-bittorrent;x-scheme-handler/magnet',
        href: this.generateMagnetUri(file, baseUrlHttp, baseUrlWs),
        height: file.resolution
      })
    }

    // Add video url too
    url.push({
      type: 'Link',
      mimeType: 'text/html',
      href: CONFIG.WEBSERVER.URL + '/videos/watch/' + this.uuid
    })

    const subtitleLanguage = []
    for (const caption of this.VideoCaptions) {
      subtitleLanguage.push({
        identifier: caption.language,
        name: VideoCaptionModel.getLanguageLabel(caption.language)
      })
    }

    return {
      type: 'Video' as 'Video',
      id: this.url,
      name: this.name,
      duration: this.getActivityStreamDuration(),
      uuid: this.uuid,
      tag,
      category,
      licence,
      language,
      views: this.views,
      sensitive: this.nsfw,
      waitTranscoding: this.waitTranscoding,
      state: this.state,
      commentsEnabled: this.commentsEnabled,
      published: this.publishedAt.toISOString(),
      updated: this.updatedAt.toISOString(),
      mediaType: 'text/markdown',
      content: this.getTruncatedDescription(),
      support: this.support,
      subtitleLanguage,
      icon: {
        type: 'Image',
        url: this.getThumbnailUrl(baseUrlHttp),
        mediaType: 'image/jpeg',
        width: THUMBNAILS_SIZE.width,
        height: THUMBNAILS_SIZE.height
      },
      url,
      likes: getVideoLikesActivityPubUrl(this),
      dislikes: getVideoDislikesActivityPubUrl(this),
      shares: getVideoSharesActivityPubUrl(this),
      comments: getVideoCommentsActivityPubUrl(this),
      attributedTo: [
        {
          type: 'Person',
          id: this.VideoChannel.Account.Actor.url
        },
        {
          type: 'Group',
          id: this.VideoChannel.Actor.url
        }
      ]
    }
  }

  getTruncatedDescription () {
    if (!this.description) return null

    const maxLength = CONSTRAINTS_FIELDS.VIDEOS.TRUNCATED_DESCRIPTION.max
    return peertubeTruncate(this.description, maxLength)
  }

  async optimizeOriginalVideofile () {
    const videosDirectory = CONFIG.STORAGE.VIDEOS_DIR
    const newExtname = '.mp4'
    const inputVideoFile = this.getOriginalFile()
    const videoInputPath = join(videosDirectory, this.getVideoFilename(inputVideoFile))
    const videoTranscodedPath = join(videosDirectory, this.id + '-transcoded' + newExtname)

    const transcodeOptions = {
      inputPath: videoInputPath,
      outputPath: videoTranscodedPath
    }

    // Could be very long!
    await transcode(transcodeOptions)

    try {
      await unlinkPromise(videoInputPath)

      // Important to do this before getVideoFilename() to take in account the new file extension
      inputVideoFile.set('extname', newExtname)

      const videoOutputPath = this.getVideoFilePath(inputVideoFile)
      await renamePromise(videoTranscodedPath, videoOutputPath)
      const stats = await statPromise(videoOutputPath)
      const fps = await getVideoFileFPS(videoOutputPath)

      inputVideoFile.set('size', stats.size)
      inputVideoFile.set('fps', fps)

      await this.createTorrentAndSetInfoHash(inputVideoFile)
      await inputVideoFile.save()

    } catch (err) {
      // Auto destruction...
      this.destroy().catch(err => logger.error('Cannot destruct video after transcoding failure.', { err }))

      throw err
    }
  }

  async transcodeOriginalVideofile (resolution: VideoResolution, isPortraitMode: boolean) {
    const videosDirectory = CONFIG.STORAGE.VIDEOS_DIR
    const extname = '.mp4'

    // We are sure it's x264 in mp4 because optimizeOriginalVideofile was already executed
    const videoInputPath = join(videosDirectory, this.getVideoFilename(this.getOriginalFile()))

    const newVideoFile = new VideoFileModel({
      resolution,
      extname,
      size: 0,
      videoId: this.id
    })
    const videoOutputPath = join(videosDirectory, this.getVideoFilename(newVideoFile))

    const transcodeOptions = {
      inputPath: videoInputPath,
      outputPath: videoOutputPath,
      resolution,
      isPortraitMode
    }

    await transcode(transcodeOptions)

    const stats = await statPromise(videoOutputPath)
    const fps = await getVideoFileFPS(videoOutputPath)

    newVideoFile.set('size', stats.size)
    newVideoFile.set('fps', fps)

    await this.createTorrentAndSetInfoHash(newVideoFile)

    await newVideoFile.save()

    this.VideoFiles.push(newVideoFile)
  }

  async importVideoFile (inputFilePath: string) {
    const { videoFileResolution } = await getVideoFileResolution(inputFilePath)
    const { size } = await statPromise(inputFilePath)
    const fps = await getVideoFileFPS(inputFilePath)

    let updatedVideoFile = new VideoFileModel({
      resolution: videoFileResolution,
      extname: extname(inputFilePath),
      size,
      fps,
      videoId: this.id
    })

    const currentVideoFile = this.VideoFiles.find(videoFile => videoFile.resolution === updatedVideoFile.resolution)

    if (currentVideoFile) {
      // Remove old file and old torrent
      await this.removeFile(currentVideoFile)
      await this.removeTorrent(currentVideoFile)
      // Remove the old video file from the array
      this.VideoFiles = this.VideoFiles.filter(f => f !== currentVideoFile)

      // Update the database
      currentVideoFile.set('extname', updatedVideoFile.extname)
      currentVideoFile.set('size', updatedVideoFile.size)
      currentVideoFile.set('fps', updatedVideoFile.fps)

      updatedVideoFile = currentVideoFile
    }

    const outputPath = this.getVideoFilePath(updatedVideoFile)
    await copyFilePromise(inputFilePath, outputPath)

    await this.createTorrentAndSetInfoHash(updatedVideoFile)

    await updatedVideoFile.save()

    this.VideoFiles.push(updatedVideoFile)
  }

  getOriginalFileResolution () {
    const originalFilePath = this.getVideoFilePath(this.getOriginalFile())

    return getVideoFileResolution(originalFilePath)
  }

  getDescriptionPath () {
    return `/api/${API_VERSION}/videos/${this.uuid}/description`
  }

  removeThumbnail () {
    const thumbnailPath = join(CONFIG.STORAGE.THUMBNAILS_DIR, this.getThumbnailName())
    return unlinkPromise(thumbnailPath)
      .catch(err => logger.warn('Cannot delete thumbnail %s.', thumbnailPath, { err }))
  }

  removePreview () {
    const previewPath = join(CONFIG.STORAGE.PREVIEWS_DIR + this.getPreviewName())
    return unlinkPromise(previewPath)
      .catch(err => logger.warn('Cannot delete preview %s.', previewPath, { err }))
  }

  removeFile (videoFile: VideoFileModel) {
    const filePath = join(CONFIG.STORAGE.VIDEOS_DIR, this.getVideoFilename(videoFile))
    return unlinkPromise(filePath)
      .catch(err => logger.warn('Cannot delete file %s.', filePath, { err }))
  }

  removeTorrent (videoFile: VideoFileModel) {
    const torrentPath = join(CONFIG.STORAGE.TORRENTS_DIR, this.getTorrentFileName(videoFile))
    return unlinkPromise(torrentPath)
      .catch(err => logger.warn('Cannot delete torrent %s.', torrentPath, { err }))
  }

  getActivityStreamDuration () {
    // https://www.w3.org/TR/activitystreams-vocabulary/#dfn-duration
    return 'PT' + this.duration + 'S'
  }

  isOutdated () {
    if (this.isOwned()) return false

    const now = Date.now()
    const createdAtTime = this.createdAt.getTime()
    const updatedAtTime = this.updatedAt.getTime()

    return (now - createdAtTime) > ACTIVITY_PUB.VIDEO_REFRESH_INTERVAL &&
      (now - updatedAtTime) > ACTIVITY_PUB.VIDEO_REFRESH_INTERVAL
  }

  private getBaseUrls () {
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

  private getThumbnailUrl (baseUrlHttp: string) {
    return baseUrlHttp + STATIC_PATHS.THUMBNAILS + this.getThumbnailName()
  }

  private getTorrentUrl (videoFile: VideoFileModel, baseUrlHttp: string) {
    return baseUrlHttp + STATIC_PATHS.TORRENTS + this.getTorrentFileName(videoFile)
  }

  private getTorrentDownloadUrl (videoFile: VideoFileModel, baseUrlHttp: string) {
    return baseUrlHttp + STATIC_DOWNLOAD_PATHS.TORRENTS + this.getTorrentFileName(videoFile)
  }

  private getVideoFileUrl (videoFile: VideoFileModel, baseUrlHttp: string) {
    return baseUrlHttp + STATIC_PATHS.WEBSEED + this.getVideoFilename(videoFile)
  }

  private getVideoFileDownloadUrl (videoFile: VideoFileModel, baseUrlHttp: string) {
    return baseUrlHttp + STATIC_DOWNLOAD_PATHS.VIDEOS + this.getVideoFilename(videoFile)
  }

  private generateMagnetUri (videoFile: VideoFileModel, baseUrlHttp: string, baseUrlWs: string) {
    const xs = this.getTorrentUrl(videoFile, baseUrlHttp)
    const announce = [ baseUrlWs + '/tracker/socket', baseUrlHttp + '/tracker/announce' ]
    const urlList = [ this.getVideoFileUrl(videoFile, baseUrlHttp) ]

    const magnetHash = {
      xs,
      announce,
      urlList,
      infoHash: videoFile.infoHash,
      name: this.name
    }

    return magnetUtil.encode(magnetHash)
  }
}
