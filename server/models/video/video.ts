import * as Bluebird from 'bluebird'
import { map, maxBy } from 'lodash'
import * as magnetUtil from 'magnet-uri'
import * as parseTorrent from 'parse-torrent'
import { join } from 'path'
import * as Sequelize from 'sequelize'
import {
  AfterDestroy,
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
import { VideoPrivacy, VideoResolution } from '../../../shared'
import { VideoTorrentObject } from '../../../shared/models/activitypub/objects'
import { Video, VideoDetails, VideoFile } from '../../../shared/models/videos'
import { VideoFilter } from '../../../shared/models/videos/video-query.type'
import { activityPubCollection } from '../../helpers/activitypub'
import {
  createTorrentPromise, peertubeTruncate, renamePromise, statPromise, unlinkPromise,
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
  isVideoSupportValid
} from '../../helpers/custom-validators/videos'
import { generateImageFromVideoFile, getVideoFileResolution, transcode } from '../../helpers/ffmpeg-utils'
import { logger } from '../../helpers/logger'
import { getServerActor } from '../../helpers/utils'
import {
  API_VERSION,
  CONFIG,
  CONSTRAINTS_FIELDS,
  PREVIEWS_SIZE,
  REMOTE_SCHEME,
  STATIC_PATHS,
  THUMBNAILS_SIZE,
  VIDEO_CATEGORIES,
  VIDEO_LANGUAGES,
  VIDEO_LICENCES,
  VIDEO_PRIVACIES
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
import { getSort, throwIfNotValid } from '../utils'
import { TagModel } from './tag'
import { VideoAbuseModel } from './video-abuse'
import { VideoChannelModel } from './video-channel'
import { VideoCommentModel } from './video-comment'
import { VideoFileModel } from './video-file'
import { VideoShareModel } from './video-share'
import { VideoTagModel } from './video-tag'

enum ScopeNames {
  AVAILABLE_FOR_LIST = 'AVAILABLE_FOR_LIST',
  WITH_ACCOUNT_DETAILS = 'WITH_ACCOUNT_DETAILS',
  WITH_TAGS = 'WITH_TAGS',
  WITH_FILES = 'WITH_FILES',
  WITH_SHARES = 'WITH_SHARES',
  WITH_RATES = 'WITH_RATES',
  WITH_COMMENTS = 'WITH_COMMENTS'
}

@Scopes({
  [ScopeNames.AVAILABLE_FOR_LIST]: (options: {
    actorId: number,
    hideNSFW: boolean,
    filter?: VideoFilter,
    withFiles?: boolean,
    accountId?: number,
    videoChannelId?: number
  }) => {
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

    // Force actorId to be a number to avoid SQL injections
    const actorIdNumber = parseInt(options.actorId.toString(), 10)
    const query: IFindOptions<VideoModel> = {
      where: {
        id: {
          [Sequelize.Op.notIn]: Sequelize.literal(
            '(SELECT "videoBlacklist"."videoId" FROM "videoBlacklist")'
          ),
          [ Sequelize.Op.in ]: Sequelize.literal(
            '(' +
            'SELECT "videoShare"."videoId" AS "id" FROM "videoShare" ' +
            'INNER JOIN "actorFollow" ON "actorFollow"."targetActorId" = "videoShare"."actorId" ' +
            'WHERE "actorFollow"."actorId" = ' + actorIdNumber +
            ' UNION ' +
            'SELECT "video"."id" AS "id" FROM "video" ' +
            'INNER JOIN "videoChannel" ON "videoChannel"."id" = "video"."channelId" ' +
            'INNER JOIN "account" ON "account"."id" = "videoChannel"."accountId" ' +
            'INNER JOIN "actor" ON "account"."actorId" = "actor"."id" ' +
            'LEFT JOIN "actorFollow" ON "actorFollow"."targetActorId" = "actor"."id" ' +
            'WHERE "actor"."serverId" IS NULL OR "actorFollow"."actorId" = ' + actorIdNumber +
            ')'
          )
        },
        privacy: VideoPrivacy.PUBLIC
      },
      include: [ videoChannelInclude ]
    }

    if (options.withFiles === true) {
      query.include.push({
        model: VideoFileModel.unscoped(),
        required: true
      })
    }

    // Hide nsfw videos?
    if (options.hideNSFW === true) {
      query.where['nsfw'] = false
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
  [ScopeNames.WITH_FILES]: {
    include: [
      {
        model: () => VideoFileModel.unscoped(),
        required: true
      }
    ]
  },
  [ScopeNames.WITH_SHARES]: {
    include: [
      {
        ['separate' as any]: true,
        model: () => VideoShareModel.unscoped()
      }
    ]
  },
  [ScopeNames.WITH_RATES]: {
    include: [
      {
        ['separate' as any]: true,
        model: () => AccountVideoRateModel,
        include: [
          {
            model: () => AccountModel.unscoped(),
            required: true,
            include: [
              {
                attributes: [ 'url' ],
                model: () => ActorModel.unscoped()
              }
            ]
          }
        ]
      }
    ]
  },
  [ScopeNames.WITH_COMMENTS]: {
    include: [
      {
        ['separate' as any]: true,
        model: () => VideoCommentModel.unscoped()
      }
    ]
  }
})
@Table({
  tableName: 'video',
  indexes: [
    {
      fields: [ 'name' ]
    },
    {
      fields: [ 'createdAt' ]
    },
    {
      fields: [ 'duration' ]
    },
    {
      fields: [ 'views' ]
    },
    {
      fields: [ 'likes' ]
    },
    {
      fields: [ 'uuid' ]
    },
    {
      fields: [ 'channelId' ]
    },
    {
      fields: [ 'id', 'privacy' ]
    },
    {
      fields: [ 'url'],
      unique: true
    }
  ]
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

      logger.debug('Sending delete of video %s.', instance.url)

      return sendDeleteVideo(instance, options.transaction)
    }

    return undefined
  }

  @BeforeDestroy
  static async removeFilesAndSendDelete (instance: VideoModel) {
    const tasks: Promise<any>[] = []

    logger.debug('Removing files of video %s.', instance.url)

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
        logger.error('Some errors when removing files of video %s in after destroy hook.', instance.uuid, { err })
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
          attributes: [ 'id', 'url' ],
          model: VideoShareModel.unscoped(),
          required: false,
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
                  attributes: [ 'id', 'url' ],
                  model: ActorModel.unscoped(),
                  required: true
                }
              ]
            },
            {
              attributes: [ 'id', 'url' ],
              model: ActorModel.unscoped(),
              required: true
            }
          ]
        },
        {
          attributes: [ 'type' ],
          model: AccountVideoRateModel,
          required: false,
          include: [
            {
              attributes: [ 'id' ],
              model: AccountModel.unscoped(),
              include: [
                {
                  attributes: [ 'url' ],
                  model: ActorModel.unscoped(),
                  include: [
                    {
                      attributes: [ 'host' ],
                      model: ServerModel,
                      required: false
                    }
                  ]
                }
              ]
            }
          ]
        },
        {
          attributes: [ 'url' ],
          model: VideoCommentModel,
          required: false
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

  static listAccountVideosForApi (accountId: number, start: number, count: number, sort: string, hideNSFW: boolean, withFiles = false) {
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
        }
      ]
    }

    if (withFiles === true) {
      query.include.push({
        model: VideoFileModel.unscoped(),
        required: true
      })
    }

    if (hideNSFW === true) {
      query.where = {
        nsfw: false
      }
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
    hideNSFW: boolean,
    withFiles: boolean,
    filter?: VideoFilter,
    accountId?: number,
    videoChannelId?: number
  }) {
    const query = {
      offset: options.start,
      limit: options.count,
      order: getSort(options.sort)
    }

    const serverActor = await getServerActor()
    const scopes = {
      method: [
        ScopeNames.AVAILABLE_FOR_LIST, {
          actorId: serverActor.id,
          hideNSFW: options.hideNSFW,
          filter: options.filter,
          withFiles: options.withFiles,
          accountId: options.accountId,
          videoChannelId: options.videoChannelId
        }
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

  static async searchAndPopulateAccountAndServer (value: string, start: number, count: number, sort: string, hideNSFW: boolean) {
    const query: IFindOptions<VideoModel> = {
      offset: start,
      limit: count,
      order: getSort(sort),
      where: {
        [Sequelize.Op.or]: [
          {
            name: {
              [ Sequelize.Op.iLike ]: '%' + value + '%'
            }
          },
          {
            preferredUsernameChannel: Sequelize.where(Sequelize.col('VideoChannel->Actor.preferredUsername'), {
              [ Sequelize.Op.iLike ]: '%' + value + '%'
            })
          },
          {
            preferredUsernameAccount: Sequelize.where(Sequelize.col('VideoChannel->Account->Actor.preferredUsername'), {
              [ Sequelize.Op.iLike ]: '%' + value + '%'
            })
          },
          {
            host: Sequelize.where(Sequelize.col('VideoChannel->Account->Actor->Server.host'), {
              [ Sequelize.Op.iLike ]: '%' + value + '%'
            })
          }
        ]
      }
    }

    const serverActor = await getServerActor()
    const scopes = {
      method: [
        ScopeNames.AVAILABLE_FOR_LIST, {
          actorId: serverActor.id,
          hideNSFW
        }
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

  static load (id: number) {
    return VideoModel.findById(id)
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

  static loadByUUIDOrURLAndPopulateAccount (uuid: string, url: string, t?: Sequelize.Transaction) {
    const query: IFindOptions<VideoModel> = {
      where: {
        [Sequelize.Op.or]: [
          { uuid },
          { url }
        ]
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
      .scope([ ScopeNames.WITH_TAGS, ScopeNames.WITH_FILES, ScopeNames.WITH_ACCOUNT_DETAILS ])
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

  static loadByUUIDAndPopulateAccountAndServerAndTags (uuid: string) {
    const options = {
      order: [ [ 'Tags', 'name', 'ASC' ] ],
      where: {
        uuid
      }
    }

    return VideoModel
      .scope([ ScopeNames.WITH_TAGS, ScopeNames.WITH_FILES, ScopeNames.WITH_ACCOUNT_DETAILS ])
      .findOne(options)
  }

  static loadAndPopulateAll (id: number) {
    const options = {
      order: [ [ 'Tags', 'name', 'ASC' ] ],
      where: {
        id
      }
    }

    return VideoModel
      .scope([
        ScopeNames.WITH_RATES,
        ScopeNames.WITH_SHARES,
        ScopeNames.WITH_TAGS,
        ScopeNames.WITH_FILES,
        ScopeNames.WITH_ACCOUNT_DETAILS,
        ScopeNames.WITH_COMMENTS
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
    let categoryLabel = VIDEO_CATEGORIES[id]
    if (!categoryLabel) categoryLabel = 'Misc'

    return categoryLabel
  }

  private static getLicenceLabel (id: number) {
    let licenceLabel = VIDEO_LICENCES[id]
    if (!licenceLabel) licenceLabel = 'Unknown'

    return licenceLabel
  }

  private static getLanguageLabel (id: string) {
    let languageLabel = VIDEO_LANGUAGES[id]
    if (!languageLabel) languageLabel = 'Unknown'

    return languageLabel
  }

  private static getPrivacyLabel (id: number) {
    let privacyLabel = VIDEO_PRIVACIES[id]
    if (!privacyLabel) privacyLabel = 'Unknown'

    return privacyLabel
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

  getEmbedPath () {
    return '/videos/embed/' + this.uuid
  }

  getThumbnailPath () {
    return join(STATIC_PATHS.THUMBNAILS, this.getThumbnailName())
  }

  getPreviewPath () {
    return join(STATIC_PATHS.PREVIEWS, this.getPreviewName())
  }

  toFormattedJSON (): Video {
    const formattedAccount = this.VideoChannel.Account.toFormattedJSON()
    const formattedVideoChannel = this.VideoChannel.toFormattedJSON()

    return {
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
      thumbnailPath: this.getThumbnailPath(),
      previewPath: this.getPreviewPath(),
      embedPath: this.getEmbedPath(),
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
  }

  toFormattedDetailsJSON (): VideoDetails {
    const formattedJson = this.toFormattedJSON()

    const detailsJson = {
      support: this.support,
      descriptionPath: this.getDescriptionPath(),
      channel: this.VideoChannel.toFormattedJSON(),
      account: this.VideoChannel.Account.toFormattedJSON(),
      tags: map(this.Tags, 'name'),
      commentsEnabled: this.commentsEnabled,
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
            torrentUrl: this.getTorrentUrl(videoFile, baseUrlHttp),
            fileUrl: this.getVideoFileUrl(videoFile, baseUrlHttp)
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

    let likesObject
    let dislikesObject

    if (Array.isArray(this.AccountVideoRates)) {
      const res = this.toRatesActivityPubObjects()
      likesObject = res.likesObject
      dislikesObject = res.dislikesObject
    }

    let sharesObject
    if (Array.isArray(this.VideoShares)) {
      sharesObject = this.toAnnouncesActivityPubObject()
    }

    let commentsObject
    if (Array.isArray(this.VideoComments)) {
      commentsObject = this.toCommentsActivityPubObject()
    }

    const url = []
    for (const file of this.VideoFiles) {
      url.push({
        type: 'Link',
        mimeType: 'video/' + file.extname.replace('.', ''),
        href: this.getVideoFileUrl(file, baseUrlHttp),
        width: file.resolution,
        size: file.size
      })

      url.push({
        type: 'Link',
        mimeType: 'application/x-bittorrent',
        href: this.getTorrentUrl(file, baseUrlHttp),
        width: file.resolution
      })

      url.push({
        type: 'Link',
        mimeType: 'application/x-bittorrent;x-scheme-handler/magnet',
        href: this.generateMagnetUri(file, baseUrlHttp, baseUrlWs),
        width: file.resolution
      })
    }

    // Add video url too
    url.push({
      type: 'Link',
      mimeType: 'text/html',
      href: CONFIG.WEBSERVER.URL + '/videos/watch/' + this.uuid
    })

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
      commentsEnabled: this.commentsEnabled,
      published: this.publishedAt.toISOString(),
      updated: this.updatedAt.toISOString(),
      mediaType: 'text/markdown',
      content: this.getTruncatedDescription(),
      support: this.support,
      icon: {
        type: 'Image',
        url: this.getThumbnailUrl(baseUrlHttp),
        mediaType: 'image/jpeg',
        width: THUMBNAILS_SIZE.width,
        height: THUMBNAILS_SIZE.height
      },
      url,
      likes: likesObject,
      dislikes: dislikesObject,
      shares: sharesObject,
      comments: commentsObject,
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

  toAnnouncesActivityPubObject () {
    const shares: string[] = []

    for (const videoShare of this.VideoShares) {
      shares.push(videoShare.url)
    }

    return activityPubCollection(getVideoSharesActivityPubUrl(this), shares)
  }

  toCommentsActivityPubObject () {
    const comments: string[] = []

    for (const videoComment of this.VideoComments) {
      comments.push(videoComment.url)
    }

    return activityPubCollection(getVideoCommentsActivityPubUrl(this), comments)
  }

  toRatesActivityPubObjects () {
    const likes: string[] = []
    const dislikes: string[] = []

    for (const rate of this.AccountVideoRates) {
      if (rate.type === 'like') {
        likes.push(rate.Account.Actor.url)
      } else if (rate.type === 'dislike') {
        dislikes.push(rate.Account.Actor.url)
      }
    }

    const likesObject = activityPubCollection(getVideoLikesActivityPubUrl(this), likes)
    const dislikesObject = activityPubCollection(getVideoDislikesActivityPubUrl(this), dislikes)

    return { likesObject, dislikesObject }
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
    const videoOutputPath = join(videosDirectory, this.id + '-transcoded' + newExtname)

    const transcodeOptions = {
      inputPath: videoInputPath,
      outputPath: videoOutputPath
    }

    // Could be very long!
    await transcode(transcodeOptions)

    try {
      await unlinkPromise(videoInputPath)

      // Important to do this before getVideoFilename() to take in account the new file extension
      inputVideoFile.set('extname', newExtname)

      await renamePromise(videoOutputPath, this.getVideoFilePath(inputVideoFile))
      const stats = await statPromise(this.getVideoFilePath(inputVideoFile))

      inputVideoFile.set('size', stats.size)

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

    newVideoFile.set('size', stats.size)

    await this.createTorrentAndSetInfoHash(newVideoFile)

    await newVideoFile.save()

    this.VideoFiles.push(newVideoFile)
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
  }

  removePreview () {
    // Same name than video thumbnail
    return unlinkPromise(CONFIG.STORAGE.PREVIEWS_DIR + this.getPreviewName())
  }

  removeFile (videoFile: VideoFileModel) {
    const filePath = join(CONFIG.STORAGE.VIDEOS_DIR, this.getVideoFilename(videoFile))
    return unlinkPromise(filePath)
  }

  removeTorrent (videoFile: VideoFileModel) {
    const torrentPath = join(CONFIG.STORAGE.TORRENTS_DIR, this.getTorrentFileName(videoFile))
    return unlinkPromise(torrentPath)
  }

  getActivityStreamDuration () {
    // https://www.w3.org/TR/activitystreams-vocabulary/#dfn-duration
    return 'PT' + this.duration + 'S'
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

  private getVideoFileUrl (videoFile: VideoFileModel, baseUrlHttp: string) {
    return baseUrlHttp + STATIC_PATHS.WEBSEED + this.getVideoFilename(videoFile)
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
