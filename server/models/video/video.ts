import * as Bluebird from 'bluebird'
import { map, maxBy, truncate } from 'lodash'
import * as magnetUtil from 'magnet-uri'
import * as parseTorrent from 'parse-torrent'
import { join } from 'path'
import * as Sequelize from 'sequelize'
import {
  AfterDestroy,
  AllowNull,
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
import { IIncludeOptions } from 'sequelize-typescript/lib/interfaces/IIncludeOptions'
import { VideoPrivacy, VideoResolution } from '../../../shared'
import { VideoTorrentObject } from '../../../shared/models/activitypub/objects'
import { Video, VideoDetails } from '../../../shared/models/videos'
import {
  activityPubCollection,
  createTorrentPromise,
  generateImageFromVideoFile,
  getVideoFileHeight,
  logger,
  renamePromise,
  statPromise,
  transcode,
  unlinkPromise,
  writeFilePromise
} from '../../helpers'
import { isActivityPubUrlValid } from '../../helpers/custom-validators/activitypub'
import {
  isVideoCategoryValid,
  isVideoDescriptionValid,
  isVideoDurationValid,
  isVideoLanguageValid,
  isVideoLicenceValid,
  isVideoNameValid,
  isVideoNSFWValid,
  isVideoPrivacyValid
} from '../../helpers/custom-validators/videos'
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
import { getAnnounceActivityPubUrl } from '../../lib/activitypub'
import { sendDeleteVideo } from '../../lib/activitypub/send'
import { AccountModel } from '../account/account'
import { AccountVideoRateModel } from '../account/account-video-rate'
import { ActorModel } from '../activitypub/actor'
import { ServerModel } from '../server/server'
import { getSort, throwIfNotValid } from '../utils'
import { TagModel } from './tag'
import { VideoAbuseModel } from './video-abuse'
import { VideoChannelModel } from './video-channel'
import { VideoFileModel } from './video-file'
import { VideoShareModel } from './video-share'
import { VideoTagModel } from './video-tag'

enum ScopeNames {
  AVAILABLE_FOR_LIST = 'AVAILABLE_FOR_LIST',
  WITH_ACCOUNT = 'WITH_ACCOUNT',
  WITH_TAGS = 'WITH_TAGS',
  WITH_FILES = 'WITH_FILES',
  WITH_SHARES = 'WITH_SHARES',
  WITH_RATES = 'WITH_RATES'
}

@Scopes({
  [ScopeNames.AVAILABLE_FOR_LIST]: {
    where: {
      id: {
        [Sequelize.Op.notIn]: Sequelize.literal(
          '(SELECT "videoBlacklist"."videoId" FROM "videoBlacklist")'
        )
      },
      privacy: VideoPrivacy.PUBLIC
    }
  },
  [ScopeNames.WITH_ACCOUNT]: {
    include: [
      {
        model: () => VideoChannelModel,
        required: true,
        include: [
          {
            model: () => AccountModel,
            required: true,
            include: [
              {
                model: () => ActorModel,
                required: true,
                include: [
                  {
                    model: () => ServerModel,
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
        model: () => VideoFileModel,
        required: true
      }
    ]
  },
  [ScopeNames.WITH_SHARES]: {
    include: [
      {
        model: () => VideoShareModel,
        include: [ () => ActorModel ]
      }
    ]
  },
  [ScopeNames.WITH_RATES]: {
    include: [
      {
        model: () => AccountVideoRateModel,
        include: [ () => AccountModel ]
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
  @Column
  language: number

  @AllowNull(false)
  @Is('VideoPrivacy', value => throwIfNotValid(value, isVideoPrivacyValid, 'privacy'))
  @Column
  privacy: number

  @AllowNull(false)
  @Is('VideoNSFW', value => throwIfNotValid(value, isVideoNSFWValid, 'NSFW boolean'))
  @Column
  nsfw: boolean

  @AllowNull(true)
  @Default(null)
  @Is('VideoDescription', value => throwIfNotValid(value, isVideoDescriptionValid, 'description'))
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.VIDEOS.DESCRIPTION.max))
  description: string

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

  @CreatedAt
  createdAt: Date

  @UpdatedAt
  updatedAt: Date

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

  @AfterDestroy
  static removeFilesAndSendDelete (instance: VideoModel) {
    const tasks = []

    tasks.push(
      instance.removeThumbnail()
    )

    if (instance.isOwned()) {
      tasks.push(
        instance.removePreview(),
        sendDeleteVideo(instance, undefined)
      )

      // Remove physical files and torrents
      instance.VideoFiles.forEach(file => {
        tasks.push(instance.removeFile(file))
        tasks.push(instance.removeTorrent(file))
      })
    }

    return Promise.all(tasks)
      .catch(err => {
        logger.error('Some errors when removing files of video %s in after destroy hook.', instance.uuid, err)
      })
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
      order: [ getSort('createdAt'), [ 'Tags', 'name', 'ASC' ] ],
      where: {
        id: {
          [Sequelize.Op.in]: Sequelize.literal('(' + rawQuery + ')')
        }
      },
      include: [
        {
          model: VideoShareModel,
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
              model: ActorModel,
              required: true
            }
          ]
        },
        {
          model: VideoChannelModel,
          required: true,
          include: [
            {
              model: AccountModel,
              required: true
            }
          ]
        },
        {
          model: AccountVideoRateModel,
          include: [ AccountModel ]
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

  static listUserVideosForApi (userId: number, start: number, count: number, sort: string) {
    const query = {
      offset: start,
      limit: count,
      order: [ getSort(sort) ],
      include: [
        {
          model: VideoChannelModel,
          required: true,
          include: [
            {
              model: AccountModel,
              where: {
                userId
              },
              required: true
            }
          ]
        }
      ]
    }

    return VideoModel.findAndCountAll(query).then(({ rows, count }) => {
      return {
        data: rows,
        total: count
      }
    })
  }

  static listForApi (start: number, count: number, sort: string) {
    const query = {
      offset: start,
      limit: count,
      order: [ getSort(sort) ]
    }

    return VideoModel.scope([ ScopeNames.AVAILABLE_FOR_LIST, ScopeNames.WITH_ACCOUNT ])
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

    return VideoModel.scope([ ScopeNames.WITH_ACCOUNT, ScopeNames.WITH_FILES ]).findOne(query)
  }

  static loadByUUIDOrURL (uuid: string, url: string, t?: Sequelize.Transaction) {
    const query: IFindOptions<VideoModel> = {
      where: {
        [Sequelize.Op.or]: [
          { uuid },
          { url }
        ]
      }
    }

    if (t !== undefined) query.transaction = t

    return VideoModel.scope(ScopeNames.WITH_FILES).findOne(query)
  }

  static loadAndPopulateAccountAndServerAndTags (id: number) {
    const options = {
      order: [ [ 'Tags', 'name', 'ASC' ] ]
    }

    return VideoModel
      .scope([ ScopeNames.WITH_RATES, ScopeNames.WITH_SHARES, ScopeNames.WITH_TAGS, ScopeNames.WITH_FILES, ScopeNames.WITH_ACCOUNT ])
      .findById(id, options)
  }

  static loadByUUIDAndPopulateAccountAndServerAndTags (uuid: string) {
    const options = {
      order: [ [ 'Tags', 'name', 'ASC' ] ],
      where: {
        uuid
      }
    }

    return VideoModel
      .scope([ ScopeNames.WITH_RATES, ScopeNames.WITH_SHARES, ScopeNames.WITH_TAGS, ScopeNames.WITH_FILES, ScopeNames.WITH_ACCOUNT ])
      .findOne(options)
  }

  static searchAndPopulateAccountAndServerAndTags (value: string, start: number, count: number, sort: string) {
    const serverInclude: IIncludeOptions = {
      model: ServerModel,
      required: false
    }

    const accountInclude: IIncludeOptions = {
      model: AccountModel,
      include: [
        {
          model: ActorModel,
          required: true,
          include: [ serverInclude ]
        }
      ]
    }

    const videoChannelInclude: IIncludeOptions = {
      model: VideoChannelModel,
      include: [ accountInclude ],
      required: true
    }

    const tagInclude: IIncludeOptions = {
      model: TagModel
    }

    const query: IFindOptions<VideoModel> = {
      distinct: true, // Because we have tags
      offset: start,
      limit: count,
      order: [ getSort(sort) ],
      where: {}
    }

    // TODO: search on tags too
    // const escapedValue = Video['sequelize'].escape('%' + value + '%')
    // query.where['id'][Sequelize.Op.in] = Video['sequelize'].literal(
    //   `(SELECT "VideoTags"."videoId"
    //     FROM "Tags"
    //     INNER JOIN "VideoTags" ON "Tags"."id" = "VideoTags"."tagId"
    //     WHERE name ILIKE ${escapedValue}
    //    )`
    // )

    // TODO: search on account too
    // accountInclude.where = {
    //   name: {
    //     [Sequelize.Op.iLike]: '%' + value + '%'
    //   }
    // }
    query.where['name'] = {
      [Sequelize.Op.iLike]: '%' + value + '%'
    }

    query.include = [
      videoChannelInclude, tagInclude
    ]

    return VideoModel.scope([ ScopeNames.AVAILABLE_FOR_LIST ])
      .findAndCountAll(query).then(({ rows, count }) => {
        return {
          data: rows,
          total: count
        }
      })
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
    const imageSize = PREVIEWS_SIZE.width + 'x' + PREVIEWS_SIZE.height

    return generateImageFromVideoFile(
      this.getVideoFilePath(videoFile),
      CONFIG.STORAGE.PREVIEWS_DIR,
      this.getPreviewName(),
      imageSize
    )
  }

  createThumbnail (videoFile: VideoFileModel) {
    const imageSize = THUMBNAILS_SIZE.width + 'x' + THUMBNAILS_SIZE.height

    return generateImageFromVideoFile(
      this.getVideoFilePath(videoFile),
      CONFIG.STORAGE.THUMBNAILS_DIR,
      this.getThumbnailName(),
      imageSize
    )
  }

  getVideoFilePath (videoFile: VideoFileModel) {
    return join(CONFIG.STORAGE.VIDEOS_DIR, this.getVideoFilename(videoFile))
  }

  createTorrentAndSetInfoHash = async function (videoFile: VideoFileModel) {
    const options = {
      announceList: [
        [ CONFIG.WEBSERVER.WS + '://' + CONFIG.WEBSERVER.HOSTNAME + ':' + CONFIG.WEBSERVER.PORT + '/tracker/socket' ]
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

  toFormattedJSON () {
    let serverHost

    if (this.VideoChannel.Account.Actor.Server) {
      serverHost = this.VideoChannel.Account.Actor.Server.host
    } else {
      // It means it's our video
      serverHost = CONFIG.WEBSERVER.HOST
    }

    return {
      id: this.id,
      uuid: this.uuid,
      name: this.name,
      category: this.category,
      categoryLabel: this.getCategoryLabel(),
      licence: this.licence,
      licenceLabel: this.getLicenceLabel(),
      language: this.language,
      languageLabel: this.getLanguageLabel(),
      nsfw: this.nsfw,
      description: this.getTruncatedDescription(),
      serverHost,
      isLocal: this.isOwned(),
      accountName: this.VideoChannel.Account.name,
      duration: this.duration,
      views: this.views,
      likes: this.likes,
      dislikes: this.dislikes,
      thumbnailPath: this.getThumbnailPath(),
      previewPath: this.getPreviewPath(),
      embedPath: this.getEmbedPath(),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    } as Video
  }

  toFormattedDetailsJSON () {
    const formattedJson = this.toFormattedJSON()

    // Maybe our server is not up to date and there are new privacy settings since our version
    let privacyLabel = VIDEO_PRIVACIES[this.privacy]
    if (!privacyLabel) privacyLabel = 'Unknown'

    const detailsJson = {
      privacyLabel,
      privacy: this.privacy,
      descriptionPath: this.getDescriptionPath(),
      channel: this.VideoChannel.toFormattedJSON(),
      account: this.VideoChannel.Account.toFormattedJSON(),
      tags: map<TagModel, string>(this.Tags, 'name'),
      files: []
    }

    // Format and sort video files
    const { baseUrlHttp, baseUrlWs } = this.getBaseUrls()
    detailsJson.files = this.VideoFiles
      .map(videoFile => {
        let resolutionLabel = videoFile.resolution + 'p'

        return {
          resolution: videoFile.resolution,
          resolutionLabel,
          magnetUri: this.generateMagnetUri(videoFile, baseUrlHttp, baseUrlWs),
          size: videoFile.size,
          torrentUrl: this.getTorrentUrl(videoFile, baseUrlHttp),
          fileUrl: this.getVideoFileUrl(videoFile, baseUrlHttp)
        }
      })
      .sort((a, b) => {
        if (a.resolution < b.resolution) return 1
        if (a.resolution === b.resolution) return 0
        return -1
      })

    return Object.assign(formattedJson, detailsJson) as VideoDetails
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
        identifier: this.language + '',
        name: this.getLanguageLabel()
      }
    }

    let category
    if (this.category) {
      category = {
        identifier: this.category + '',
        name: this.getCategoryLabel()
      }
    }

    let licence
    if (this.licence) {
      licence = {
        identifier: this.licence + '',
        name: this.getLicenceLabel()
      }
    }

    let likesObject
    let dislikesObject

    if (Array.isArray(this.AccountVideoRates)) {
      const likes: string[] = []
      const dislikes: string[] = []

      for (const rate of this.AccountVideoRates) {
        if (rate.type === 'like') {
          likes.push(rate.Account.Actor.url)
        } else if (rate.type === 'dislike') {
          dislikes.push(rate.Account.Actor.url)
        }
      }

      likesObject = activityPubCollection(likes)
      dislikesObject = activityPubCollection(dislikes)
    }

    let sharesObject
    if (Array.isArray(this.VideoShares)) {
      const shares: string[] = []

      for (const videoShare of this.VideoShares) {
        const shareUrl = getAnnounceActivityPubUrl(this.url, videoShare.Actor)
        shares.push(shareUrl)
      }

      sharesObject = activityPubCollection(shares)
    }

    const url = []
    for (const file of this.VideoFiles) {
      url.push({
        type: 'Link',
        mimeType: 'video/' + file.extname.replace('.', ''),
        url: this.getVideoFileUrl(file, baseUrlHttp),
        width: file.resolution,
        size: file.size
      })

      url.push({
        type: 'Link',
        mimeType: 'application/x-bittorrent',
        url: this.getTorrentUrl(file, baseUrlHttp),
        width: file.resolution
      })

      url.push({
        type: 'Link',
        mimeType: 'application/x-bittorrent;x-scheme-handler/magnet',
        url: this.generateMagnetUri(file, baseUrlHttp, baseUrlWs),
        width: file.resolution
      })
    }

    // Add video url too
    url.push({
      type: 'Link',
      mimeType: 'text/html',
      url: CONFIG.WEBSERVER.URL + '/videos/watch/' + this.uuid
    })

    return {
      type: 'Video' as 'Video',
      id: this.url,
      name: this.name,
      // https://www.w3.org/TR/activitystreams-vocabulary/#dfn-duration
      duration: 'PT' + this.duration + 'S',
      uuid: this.uuid,
      tag,
      category,
      licence,
      language,
      views: this.views,
      nsfw: this.nsfw,
      published: this.createdAt.toISOString(),
      updated: this.updatedAt.toISOString(),
      mediaType: 'text/markdown',
      content: this.getTruncatedDescription(),
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
      attributedTo: [
        {
          type: 'Group',
          id: this.VideoChannel.Actor.url
        }
      ]
    }
  }

  getTruncatedDescription () {
    if (!this.description) return null

    const options = {
      length: CONSTRAINTS_FIELDS.VIDEOS.TRUNCATED_DESCRIPTION.max
    }

    return truncate(this.description, options)
  }

  optimizeOriginalVideofile = async function () {
    const videosDirectory = CONFIG.STORAGE.VIDEOS_DIR
    const newExtname = '.mp4'
    const inputVideoFile = this.getOriginalFile()
    const videoInputPath = join(videosDirectory, this.getVideoFilename(inputVideoFile))
    const videoOutputPath = join(videosDirectory, this.id + '-transcoded' + newExtname)

    const transcodeOptions = {
      inputPath: videoInputPath,
      outputPath: videoOutputPath
    }

    try {
      // Could be very long!
      await transcode(transcodeOptions)

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
      this.destroy().catch(err => logger.error('Cannot destruct video after transcoding failure.', err))

      throw err
    }
  }

  transcodeOriginalVideofile = async function (resolution: VideoResolution) {
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
      resolution
    }

    await transcode(transcodeOptions)

    const stats = await statPromise(videoOutputPath)

    newVideoFile.set('size', stats.size)

    await this.createTorrentAndSetInfoHash(newVideoFile)

    await newVideoFile.save()

    this.VideoFiles.push(newVideoFile)
  }

  getOriginalFileHeight () {
    const originalFilePath = this.getVideoFilePath(this.getOriginalFile())

    return getVideoFileHeight(originalFilePath)
  }

  getDescriptionPath () {
    return `/api/${API_VERSION}/videos/${this.uuid}/description`
  }

  getCategoryLabel () {
    let categoryLabel = VIDEO_CATEGORIES[this.category]
    if (!categoryLabel) categoryLabel = 'Misc'

    return categoryLabel
  }

  getLicenceLabel () {
    let licenceLabel = VIDEO_LICENCES[this.licence]
    if (!licenceLabel) licenceLabel = 'Unknown'

    return licenceLabel
  }

  getLanguageLabel () {
    let languageLabel = VIDEO_LANGUAGES[this.language]
    if (!languageLabel) languageLabel = 'Unknown'

    return languageLabel
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
