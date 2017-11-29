import * as Bluebird from 'bluebird'
import { map, maxBy, truncate } from 'lodash'
import * as magnetUtil from 'magnet-uri'
import * as parseTorrent from 'parse-torrent'
import { join } from 'path'
import * as Sequelize from 'sequelize'
import { VideoPrivacy, VideoResolution } from '../../../shared'
import { VideoTorrentObject } from '../../../shared/models/activitypub/objects/video-torrent-object'
import { activityPubCollection } from '../../helpers/activitypub'
import { createTorrentPromise, renamePromise, statPromise, unlinkPromise, writeFilePromise } from '../../helpers/core-utils'
import { isVideoCategoryValid, isVideoLanguageValid, isVideoPrivacyValid } from '../../helpers/custom-validators/videos'
import { generateImageFromVideoFile, getVideoFileHeight, transcode } from '../../helpers/ffmpeg-utils'
import {
  isActivityPubUrlValid,
  isVideoDescriptionValid,
  isVideoDurationValid,
  isVideoLicenceValid,
  isVideoNameValid,
  isVideoNSFWValid
} from '../../helpers/index'
import { logger } from '../../helpers/logger'
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
} from '../../initializers/constants'
import { getAnnounceActivityPubUrl } from '../../lib/activitypub/url'
import { sendDeleteVideo } from '../../lib/index'
import { addMethodsToModel, getSort } from '../utils'
import { TagInstance } from './tag-interface'
import { VideoFileInstance, VideoFileModel } from './video-file-interface'
import { VideoAttributes, VideoInstance, VideoMethods } from './video-interface'

let Video: Sequelize.Model<VideoInstance, VideoAttributes>
let getOriginalFile: VideoMethods.GetOriginalFile
let getVideoFilename: VideoMethods.GetVideoFilename
let getThumbnailName: VideoMethods.GetThumbnailName
let getThumbnailPath: VideoMethods.GetThumbnailPath
let getPreviewName: VideoMethods.GetPreviewName
let getPreviewPath: VideoMethods.GetPreviewPath
let getTorrentFileName: VideoMethods.GetTorrentFileName
let isOwned: VideoMethods.IsOwned
let toFormattedJSON: VideoMethods.ToFormattedJSON
let toFormattedDetailsJSON: VideoMethods.ToFormattedDetailsJSON
let toActivityPubObject: VideoMethods.ToActivityPubObject
let optimizeOriginalVideofile: VideoMethods.OptimizeOriginalVideofile
let transcodeOriginalVideofile: VideoMethods.TranscodeOriginalVideofile
let createPreview: VideoMethods.CreatePreview
let createThumbnail: VideoMethods.CreateThumbnail
let getVideoFilePath: VideoMethods.GetVideoFilePath
let createTorrentAndSetInfoHash: VideoMethods.CreateTorrentAndSetInfoHash
let getOriginalFileHeight: VideoMethods.GetOriginalFileHeight
let getEmbedPath: VideoMethods.GetEmbedPath
let getDescriptionPath: VideoMethods.GetDescriptionPath
let getTruncatedDescription: VideoMethods.GetTruncatedDescription
let getCategoryLabel: VideoMethods.GetCategoryLabel
let getLicenceLabel: VideoMethods.GetLicenceLabel
let getLanguageLabel: VideoMethods.GetLanguageLabel

let list: VideoMethods.List
let listForApi: VideoMethods.ListForApi
let listAllAndSharedByAccountForOutbox: VideoMethods.ListAllAndSharedByAccountForOutbox
let listUserVideosForApi: VideoMethods.ListUserVideosForApi
let load: VideoMethods.Load
let loadByUrlAndPopulateAccount: VideoMethods.LoadByUrlAndPopulateAccount
let loadByUUID: VideoMethods.LoadByUUID
let loadByUUIDOrURL: VideoMethods.LoadByUUIDOrURL
let loadAndPopulateAccountAndServerAndTags: VideoMethods.LoadAndPopulateAccountAndServerAndTags
let loadByUUIDAndPopulateAccountAndServerAndTags: VideoMethods.LoadByUUIDAndPopulateAccountAndServerAndTags
let searchAndPopulateAccountAndServerAndTags: VideoMethods.SearchAndPopulateAccountAndServerAndTags
let removeThumbnail: VideoMethods.RemoveThumbnail
let removePreview: VideoMethods.RemovePreview
let removeFile: VideoMethods.RemoveFile
let removeTorrent: VideoMethods.RemoveTorrent

export default function (sequelize: Sequelize.Sequelize, DataTypes: Sequelize.DataTypes) {
  Video = sequelize.define<VideoInstance, VideoAttributes>('Video',
    {
      uuid: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false,
        validate: {
          isUUID: 4
        }
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          nameValid: value => {
            const res = isVideoNameValid(value)
            if (res === false) throw new Error('Video name is not valid.')
          }
        }
      },
      category: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
          categoryValid: value => {
            const res = isVideoCategoryValid(value)
            if (res === false) throw new Error('Video category is not valid.')
          }
        }
      },
      licence: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: null,
        validate: {
          licenceValid: value => {
            const res = isVideoLicenceValid(value)
            if (res === false) throw new Error('Video licence is not valid.')
          }
        }
      },
      language: {
        type: DataTypes.INTEGER,
        allowNull: true,
        validate: {
          languageValid: value => {
            const res = isVideoLanguageValid(value)
            if (res === false) throw new Error('Video language is not valid.')
          }
        }
      },
      privacy: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
          privacyValid: value => {
            const res = isVideoPrivacyValid(value)
            if (res === false) throw new Error('Video privacy is not valid.')
          }
        }
      },
      nsfw: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        validate: {
          nsfwValid: value => {
            const res = isVideoNSFWValid(value)
            if (res === false) throw new Error('Video nsfw attribute is not valid.')
          }
        }
      },
      description: {
        type: DataTypes.STRING(CONSTRAINTS_FIELDS.VIDEOS.DESCRIPTION.max),
        allowNull: false,
        validate: {
          descriptionValid: value => {
            const res = isVideoDescriptionValid(value)
            if (res === false) throw new Error('Video description is not valid.')
          }
        }
      },
      duration: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
          durationValid: value => {
            const res = isVideoDurationValid(value)
            if (res === false) throw new Error('Video duration is not valid.')
          }
        }
      },
      views: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        validate: {
          min: 0,
          isInt: true
        }
      },
      likes: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        validate: {
          min: 0,
          isInt: true
        }
      },
      dislikes: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        validate: {
          min: 0,
          isInt: true
        }
      },
      remote: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      url: {
        type: DataTypes.STRING(CONSTRAINTS_FIELDS.VIDEOS.URL.max),
        allowNull: false,
        validate: {
          urlValid: value => {
            const res = isActivityPubUrlValid(value)
            if (res === false) throw new Error('Video URL is not valid.')
          }
        }
      }
    },
    {
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
      ],
      hooks: {
        afterDestroy
      }
    }
  )

  const classMethods = [
    associate,

    list,
    listAllAndSharedByAccountForOutbox,
    listForApi,
    listUserVideosForApi,
    load,
    loadByUrlAndPopulateAccount,
    loadAndPopulateAccountAndServerAndTags,
    loadByUUIDOrURL,
    loadByUUID,
    loadByUUIDAndPopulateAccountAndServerAndTags,
    searchAndPopulateAccountAndServerAndTags
  ]
  const instanceMethods = [
    createPreview,
    createThumbnail,
    createTorrentAndSetInfoHash,
    getPreviewName,
    getPreviewPath,
    getThumbnailName,
    getThumbnailPath,
    getTorrentFileName,
    getVideoFilename,
    getVideoFilePath,
    getOriginalFile,
    isOwned,
    removeFile,
    removePreview,
    removeThumbnail,
    removeTorrent,
    toActivityPubObject,
    toFormattedJSON,
    toFormattedDetailsJSON,
    optimizeOriginalVideofile,
    transcodeOriginalVideofile,
    getOriginalFileHeight,
    getEmbedPath,
    getTruncatedDescription,
    getDescriptionPath,
    getCategoryLabel,
    getLicenceLabel,
    getLanguageLabel
  ]
  addMethodsToModel(Video, classMethods, instanceMethods)

  return Video
}

// ------------------------------ METHODS ------------------------------

function associate (models) {
  Video.belongsTo(models.VideoChannel, {
    foreignKey: {
      name: 'channelId',
      allowNull: false
    },
    onDelete: 'cascade'
  })

  Video.belongsToMany(models.Tag, {
    foreignKey: 'videoId',
    through: models.VideoTag,
    onDelete: 'cascade'
  })

  Video.hasMany(models.VideoAbuse, {
    foreignKey: {
      name: 'videoId',
      allowNull: false
    },
    onDelete: 'cascade'
  })

  Video.hasMany(models.VideoFile, {
    foreignKey: {
      name: 'videoId',
      allowNull: false
    },
    onDelete: 'cascade'
  })

  Video.hasMany(models.VideoShare, {
    foreignKey: {
      name: 'videoId',
      allowNull: false
    },
    onDelete: 'cascade'
  })

  Video.hasMany(models.AccountVideoRate, {
    foreignKey: {
      name: 'videoId',
      allowNull: false
    },
    onDelete: 'cascade'
  })
}

function afterDestroy (video: VideoInstance) {
  const tasks = []

  tasks.push(
    video.removeThumbnail()
  )

  if (video.isOwned()) {
    tasks.push(
      video.removePreview(),
      sendDeleteVideo(video, undefined)
    )

    // Remove physical files and torrents
    video.VideoFiles.forEach(file => {
      tasks.push(video.removeFile(file))
      tasks.push(video.removeTorrent(file))
    })
  }

  return Promise.all(tasks)
    .catch(err => {
      logger.error('Some errors when removing files of video %s in after destroy hook.', video.uuid, err)
    })
}

getOriginalFile = function (this: VideoInstance) {
  if (Array.isArray(this.VideoFiles) === false) return undefined

  // The original file is the file that have the higher resolution
  return maxBy(this.VideoFiles, file => file.resolution)
}

getVideoFilename = function (this: VideoInstance, videoFile: VideoFileInstance) {
  return this.uuid + '-' + videoFile.resolution + videoFile.extname
}

getThumbnailName = function (this: VideoInstance) {
  // We always have a copy of the thumbnail
  const extension = '.jpg'
  return this.uuid + extension
}

getPreviewName = function (this: VideoInstance) {
  const extension = '.jpg'
  return this.uuid + extension
}

getTorrentFileName = function (this: VideoInstance, videoFile: VideoFileInstance) {
  const extension = '.torrent'
  return this.uuid + '-' + videoFile.resolution + extension
}

isOwned = function (this: VideoInstance) {
  return this.remote === false
}

createPreview = function (this: VideoInstance, videoFile: VideoFileInstance) {
  const imageSize = PREVIEWS_SIZE.width + 'x' + PREVIEWS_SIZE.height

  return generateImageFromVideoFile(
    this.getVideoFilePath(videoFile),
    CONFIG.STORAGE.PREVIEWS_DIR,
    this.getPreviewName(),
    imageSize
  )
}

createThumbnail = function (this: VideoInstance, videoFile: VideoFileInstance) {
  const imageSize = THUMBNAILS_SIZE.width + 'x' + THUMBNAILS_SIZE.height

  return generateImageFromVideoFile(
    this.getVideoFilePath(videoFile),
    CONFIG.STORAGE.THUMBNAILS_DIR,
    this.getThumbnailName(),
    imageSize
  )
}

getVideoFilePath = function (this: VideoInstance, videoFile: VideoFileInstance) {
  return join(CONFIG.STORAGE.VIDEOS_DIR, this.getVideoFilename(videoFile))
}

createTorrentAndSetInfoHash = async function (this: VideoInstance, videoFile: VideoFileInstance) {
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

getEmbedPath = function (this: VideoInstance) {
  return '/videos/embed/' + this.uuid
}

getThumbnailPath = function (this: VideoInstance) {
  return join(STATIC_PATHS.THUMBNAILS, this.getThumbnailName())
}

getPreviewPath = function (this: VideoInstance) {
  return join(STATIC_PATHS.PREVIEWS, this.getPreviewName())
}

toFormattedJSON = function (this: VideoInstance) {
  let serverHost

  if (this.VideoChannel.Account.Server) {
    serverHost = this.VideoChannel.Account.Server.host
  } else {
    // It means it's our video
    serverHost = CONFIG.WEBSERVER.HOST
  }

  const json = {
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
    account: this.VideoChannel.Account.name,
    duration: this.duration,
    views: this.views,
    likes: this.likes,
    dislikes: this.dislikes,
    tags: map<TagInstance, string>(this.Tags, 'name'),
    thumbnailPath: this.getThumbnailPath(),
    previewPath: this.getPreviewPath(),
    embedPath: this.getEmbedPath(),
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  }

  return json
}

toFormattedDetailsJSON = function (this: VideoInstance) {
  const formattedJson = this.toFormattedJSON()

  // Maybe our server is not up to date and there are new privacy settings since our version
  let privacyLabel = VIDEO_PRIVACIES[this.privacy]
  if (!privacyLabel) privacyLabel = 'Unknown'

  const detailsJson = {
    privacyLabel,
    privacy: this.privacy,
    descriptionPath: this.getDescriptionPath(),
    channel: this.VideoChannel.toFormattedJSON(),
    files: []
  }

  // Format and sort video files
  const { baseUrlHttp, baseUrlWs } = getBaseUrls(this)
  detailsJson.files = this.VideoFiles
                   .map(videoFile => {
                     let resolutionLabel = videoFile.resolution + 'p'

                     const videoFileJson = {
                       resolution: videoFile.resolution,
                       resolutionLabel,
                       magnetUri: generateMagnetUri(this, videoFile, baseUrlHttp, baseUrlWs),
                       size: videoFile.size,
                       torrentUrl: getTorrentUrl(this, videoFile, baseUrlHttp),
                       fileUrl: getVideoFileUrl(this, videoFile, baseUrlHttp)
                     }

                     return videoFileJson
                   })
                   .sort((a, b) => {
                     if (a.resolution < b.resolution) return 1
                     if (a.resolution === b.resolution) return 0
                     return -1
                   })

  return Object.assign(formattedJson, detailsJson)
}

toActivityPubObject = function (this: VideoInstance) {
  const { baseUrlHttp, baseUrlWs } = getBaseUrls(this)
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

  let likesObject
  let dislikesObject

  if (Array.isArray(this.AccountVideoRates)) {
    const likes: string[] = []
    const dislikes: string[] = []

    for (const rate of this.AccountVideoRates) {
      if (rate.type === 'like') {
        likes.push(rate.Account.url)
      } else if (rate.type === 'dislike') {
        dislikes.push(rate.Account.url)
      }
    }

    likesObject = activityPubCollection(likes)
    dislikesObject = activityPubCollection(dislikes)
  }

  let sharesObject
  if (Array.isArray(this.VideoShares)) {
    const shares: string[] = []

    for (const videoShare of this.VideoShares) {
      const shareUrl = getAnnounceActivityPubUrl(this.url, videoShare.Account)
      shares.push(shareUrl)
    }

    sharesObject = activityPubCollection(shares)
  }

  const url = []
  for (const file of this.VideoFiles) {
    url.push({
      type: 'Link',
      mimeType: 'video/' + file.extname.replace('.', ''),
      url: getVideoFileUrl(this, file, baseUrlHttp),
      width: file.resolution,
      size: file.size
    })

    url.push({
      type: 'Link',
      mimeType: 'application/x-bittorrent',
      url: getTorrentUrl(this, file, baseUrlHttp),
      width: file.resolution
    })

    url.push({
      type: 'Link',
      mimeType: 'application/x-bittorrent;x-scheme-handler/magnet',
      url: generateMagnetUri(this, file, baseUrlHttp, baseUrlWs),
      width: file.resolution
    })
  }

  // Add video url too
  url.push({
    type: 'Link',
    mimeType: 'text/html',
    url: CONFIG.WEBSERVER.URL + '/videos/watch/' + this.uuid
  })

  const videoObject: VideoTorrentObject = {
    type: 'Video' as 'Video',
    id: this.url,
    name: this.name,
    // https://www.w3.org/TR/activitystreams-vocabulary/#dfn-duration
    duration: 'PT' + this.duration + 'S',
    uuid: this.uuid,
    tag,
    category: {
      identifier: this.category + '',
      name: this.getCategoryLabel()
    },
    licence: {
      identifier: this.licence + '',
      name: this.getLicenceLabel()
    },
    language,
    views: this.views,
    nsfw: this.nsfw,
    published: this.createdAt.toISOString(),
    updated: this.updatedAt.toISOString(),
    mediaType: 'text/markdown',
    content: this.getTruncatedDescription(),
    icon: {
      type: 'Image',
      url: getThumbnailUrl(this, baseUrlHttp),
      mediaType: 'image/jpeg',
      width: THUMBNAILS_SIZE.width,
      height: THUMBNAILS_SIZE.height
    },
    url,
    likes: likesObject,
    dislikes: dislikesObject,
    shares: sharesObject
  }

  return videoObject
}

getTruncatedDescription = function (this: VideoInstance) {
  const options = {
    length: CONSTRAINTS_FIELDS.VIDEOS.TRUNCATED_DESCRIPTION.max
  }

  return truncate(this.description, options)
}

optimizeOriginalVideofile = async function (this: VideoInstance) {
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

transcodeOriginalVideofile = async function (this: VideoInstance, resolution: VideoResolution) {
  const videosDirectory = CONFIG.STORAGE.VIDEOS_DIR
  const extname = '.mp4'

  // We are sure it's x264 in mp4 because optimizeOriginalVideofile was already executed
  const videoInputPath = join(videosDirectory, this.getVideoFilename(this.getOriginalFile()))

  const newVideoFile = (Video['sequelize'].models.VideoFile as VideoFileModel).build({
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

getOriginalFileHeight = function (this: VideoInstance) {
  const originalFilePath = this.getVideoFilePath(this.getOriginalFile())

  return getVideoFileHeight(originalFilePath)
}

getDescriptionPath = function (this: VideoInstance) {
  return `/api/${API_VERSION}/videos/${this.uuid}/description`
}

getCategoryLabel = function (this: VideoInstance) {
  let categoryLabel = VIDEO_CATEGORIES[this.category]

  // Maybe our server is not up to date and there are new categories since our version
  if (!categoryLabel) categoryLabel = 'Misc'

  return categoryLabel
}

getLicenceLabel = function (this: VideoInstance) {
  let licenceLabel = VIDEO_LICENCES[this.licence]

  // Maybe our server is not up to date and there are new licences since our version
  if (!licenceLabel) licenceLabel = 'Unknown'

  return licenceLabel
}

getLanguageLabel = function (this: VideoInstance) {
  // Language is an optional attribute
  let languageLabel = VIDEO_LANGUAGES[this.language]
  if (!languageLabel) languageLabel = 'Unknown'

  return languageLabel
}

removeThumbnail = function (this: VideoInstance) {
  const thumbnailPath = join(CONFIG.STORAGE.THUMBNAILS_DIR, this.getThumbnailName())
  return unlinkPromise(thumbnailPath)
}

removePreview = function (this: VideoInstance) {
  // Same name than video thumbnail
  return unlinkPromise(CONFIG.STORAGE.PREVIEWS_DIR + this.getPreviewName())
}

removeFile = function (this: VideoInstance, videoFile: VideoFileInstance) {
  const filePath = join(CONFIG.STORAGE.VIDEOS_DIR, this.getVideoFilename(videoFile))
  return unlinkPromise(filePath)
}

removeTorrent = function (this: VideoInstance, videoFile: VideoFileInstance) {
  const torrentPath = join(CONFIG.STORAGE.TORRENTS_DIR, this.getTorrentFileName(videoFile))
  return unlinkPromise(torrentPath)
}

// ------------------------------ STATICS ------------------------------

list = function () {
  const query = {
    include: [ Video['sequelize'].models.VideoFile ]
  }

  return Video.findAll(query)
}

listAllAndSharedByAccountForOutbox = function (accountId: number, start: number, count: number) {
  function getRawQuery (select: string) {
    const queryVideo = 'SELECT ' + select + ' FROM "Videos" AS "Video" ' +
      'INNER JOIN "VideoChannels" AS "VideoChannel" ON "VideoChannel"."id" = "Video"."channelId" ' +
      'WHERE "VideoChannel"."accountId" = ' + accountId
    const queryVideoShare = 'SELECT ' + select + ' FROM "VideoShares" AS "VideoShare" ' +
      'INNER JOIN "Videos" AS "Video" ON "Video"."id" = "VideoShare"."videoId" ' +
      'WHERE "VideoShare"."accountId" = ' + accountId

    let rawQuery = `(${queryVideo}) UNION (${queryVideoShare})`

    return rawQuery
  }

  const rawQuery = getRawQuery('"Video"."id"')
  const rawCountQuery = getRawQuery('COUNT("Video"."id") as "total"')

  const query = {
    distinct: true,
    offset: start,
    limit: count,
    order: [ getSort('createdAt'), [ Video['sequelize'].models.Tag, 'name', 'ASC' ] ],
    where: {
      id: {
        [Sequelize.Op.in]: Sequelize.literal('(' + rawQuery + ')')
      }
    },
    include: [
      {
        model: Video['sequelize'].models.VideoShare,
        required: false,
        where: {
          [Sequelize.Op.and]: [
            {
              id: {
                [Sequelize.Op.not]: null
              }
            },
            {
              accountId
            }
          ]
        },
        include: [ Video['sequelize'].models.Account ]
      },
      {
        model: Video['sequelize'].models.VideoChannel,
        required: true,
        include: [
          {
            model: Video['sequelize'].models.Account,
            required: true
          }
        ]
      },
      {
        model: Video['sequelize'].models.AccountVideoRate,
        include: [ Video['sequelize'].models.Account ]
      },
      Video['sequelize'].models.VideoFile,
      Video['sequelize'].models.Tag
    ]
  }

  return Bluebird.all([
    Video.findAll(query),
    Video['sequelize'].query(rawCountQuery, { type: Sequelize.QueryTypes.SELECT })
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

listUserVideosForApi = function (userId: number, start: number, count: number, sort: string) {
  const query = {
    distinct: true,
    offset: start,
    limit: count,
    order: [ getSort(sort), [ Video['sequelize'].models.Tag, 'name', 'ASC' ] ],
    include: [
      {
        model: Video['sequelize'].models.VideoChannel,
        required: true,
        include: [
          {
            model: Video['sequelize'].models.Account,
            where: {
              userId
            },
            required: true
          }
        ]
      },
      Video['sequelize'].models.Tag
    ]
  }

  return Video.findAndCountAll(query).then(({ rows, count }) => {
    return {
      data: rows,
      total: count
    }
  })
}

listForApi = function (start: number, count: number, sort: string) {
  const query = {
    distinct: true,
    offset: start,
    limit: count,
    order: [ getSort(sort), [ Video['sequelize'].models.Tag, 'name', 'ASC' ] ],
    include: [
      {
        model: Video['sequelize'].models.VideoChannel,
        required: true,
        include: [
          {
            model: Video['sequelize'].models.Account,
            required: true,
            include: [
              {
                model: Video['sequelize'].models.Server,
                required: false
              }
            ]
          }
        ]
      },
      Video['sequelize'].models.Tag
    ],
    where: createBaseVideosWhere()
  }

  return Video.findAndCountAll(query).then(({ rows, count }) => {
    return {
      data: rows,
      total: count
    }
  })
}

load = function (id: number) {
  return Video.findById(id)
}

loadByUUID = function (uuid: string, t?: Sequelize.Transaction) {
  const query: Sequelize.FindOptions<VideoAttributes> = {
    where: {
      uuid
    },
    include: [ Video['sequelize'].models.VideoFile ]
  }

  if (t !== undefined) query.transaction = t

  return Video.findOne(query)
}

loadByUrlAndPopulateAccount = function (url: string, t?: Sequelize.Transaction) {
  const query: Sequelize.FindOptions<VideoAttributes> = {
    where: {
      url
    },
    include: [
      Video['sequelize'].models.VideoFile,
      {
        model: Video['sequelize'].models.VideoChannel,
        include: [ Video['sequelize'].models.Account ]
      }
    ]
  }

  if (t !== undefined) query.transaction = t

  return Video.findOne(query)
}

loadByUUIDOrURL = function (uuid: string, url: string, t?: Sequelize.Transaction) {
  const query: Sequelize.FindOptions<VideoAttributes> = {
    where: {
      [Sequelize.Op.or]: [
        { uuid },
        { url }
      ]
    },
    include: [ Video['sequelize'].models.VideoFile ]
  }

  if (t !== undefined) query.transaction = t

  return Video.findOne(query)
}

loadAndPopulateAccountAndServerAndTags = function (id: number) {
  const options = {
    order: [ [ Video['sequelize'].models.Tag, 'name', 'ASC' ] ],
    include: [
      {
        model: Video['sequelize'].models.VideoChannel,
        include: [
          {
            model: Video['sequelize'].models.Account,
            include: [ { model: Video['sequelize'].models.Server, required: false } ]
          }
        ]
      },
      {
        model: Video['sequelize'].models.AccountVideoRate,
        include: [ Video['sequelize'].models.Account ]
      },
      {
        model: Video['sequelize'].models.VideoShare,
        include: [ Video['sequelize'].models.Account ]
      },
      Video['sequelize'].models.Tag,
      Video['sequelize'].models.VideoFile
    ]
  }

  return Video.findById(id, options)
}

loadByUUIDAndPopulateAccountAndServerAndTags = function (uuid: string) {
  const options = {
    order: [ [ Video['sequelize'].models.Tag, 'name', 'ASC' ] ],
    where: {
      uuid
    },
    include: [
      {
        model: Video['sequelize'].models.VideoChannel,
        include: [
          {
            model: Video['sequelize'].models.Account,
            include: [ { model: Video['sequelize'].models.Server, required: false } ]
          }
        ]
      },
      {
        model: Video['sequelize'].models.AccountVideoRate,
        include: [ Video['sequelize'].models.Account ]
      },
      {
        model: Video['sequelize'].models.VideoShare,
        include: [ Video['sequelize'].models.Account ]
      },
      Video['sequelize'].models.Tag,
      Video['sequelize'].models.VideoFile
    ]
  }

  return Video.findOne(options)
}

searchAndPopulateAccountAndServerAndTags = function (value: string, field: string, start: number, count: number, sort: string) {
  const serverInclude: Sequelize.IncludeOptions = {
    model: Video['sequelize'].models.Server,
    required: false
  }

  const accountInclude: Sequelize.IncludeOptions = {
    model: Video['sequelize'].models.Account,
    include: [ serverInclude ]
  }

  const videoChannelInclude: Sequelize.IncludeOptions = {
    model: Video['sequelize'].models.VideoChannel,
    include: [ accountInclude ],
    required: true
  }

  const tagInclude: Sequelize.IncludeOptions = {
    model: Video['sequelize'].models.Tag
  }

  const query: Sequelize.FindOptions<VideoAttributes> = {
    distinct: true,
    where: createBaseVideosWhere(),
    offset: start,
    limit: count,
    order: [ getSort(sort), [ Video['sequelize'].models.Tag, 'name', 'ASC' ] ]
  }

  if (field === 'tags') {
    const escapedValue = Video['sequelize'].escape('%' + value + '%')
    query.where['id'][Sequelize.Op.in] = Video['sequelize'].literal(
      `(SELECT "VideoTags"."videoId"
        FROM "Tags"
        INNER JOIN "VideoTags" ON "Tags"."id" = "VideoTags"."tagId"
        WHERE name ILIKE ${escapedValue}
       )`
    )
  } else if (field === 'host') {
    // FIXME: Include our server? (not stored in the database)
    serverInclude.where = {
      host: {
        [Sequelize.Op.iLike]: '%' + value + '%'
      }
    }
    serverInclude.required = true
  } else if (field === 'account') {
    accountInclude.where = {
      name: {
        [Sequelize.Op.iLike]: '%' + value + '%'
      }
    }
  } else {
    query.where[field] = {
      [Sequelize.Op.iLike]: '%' + value + '%'
    }
  }

  query.include = [
    videoChannelInclude, tagInclude
  ]

  return Video.findAndCountAll(query).then(({ rows, count }) => {
    return {
      data: rows,
      total: count
    }
  })
}

// ---------------------------------------------------------------------------

function createBaseVideosWhere () {
  return {
    id: {
      [Sequelize.Op.notIn]: Video['sequelize'].literal(
        '(SELECT "BlacklistedVideos"."videoId" FROM "BlacklistedVideos")'
      )
    },
    privacy: VideoPrivacy.PUBLIC
  }
}

function getBaseUrls (video: VideoInstance) {
  let baseUrlHttp
  let baseUrlWs

  if (video.isOwned()) {
    baseUrlHttp = CONFIG.WEBSERVER.URL
    baseUrlWs = CONFIG.WEBSERVER.WS + '://' + CONFIG.WEBSERVER.HOSTNAME + ':' + CONFIG.WEBSERVER.PORT
  } else {
    baseUrlHttp = REMOTE_SCHEME.HTTP + '://' + video.VideoChannel.Account.Server.host
    baseUrlWs = REMOTE_SCHEME.WS + '://' + video.VideoChannel.Account.Server.host
  }

  return { baseUrlHttp, baseUrlWs }
}

function getThumbnailUrl (video: VideoInstance, baseUrlHttp: string) {
  return baseUrlHttp + STATIC_PATHS.THUMBNAILS + video.getThumbnailName()
}

function getTorrentUrl (video: VideoInstance, videoFile: VideoFileInstance, baseUrlHttp: string) {
  return baseUrlHttp + STATIC_PATHS.TORRENTS + video.getTorrentFileName(videoFile)
}

function getVideoFileUrl (video: VideoInstance, videoFile: VideoFileInstance, baseUrlHttp: string) {
  return baseUrlHttp + STATIC_PATHS.WEBSEED + video.getVideoFilename(videoFile)
}

function generateMagnetUri (video: VideoInstance, videoFile: VideoFileInstance, baseUrlHttp: string, baseUrlWs: string) {
  const xs = getTorrentUrl(video, videoFile, baseUrlHttp)
  const announce = [ baseUrlWs + '/tracker/socket', baseUrlHttp + '/tracker/announce' ]
  const urlList = [ getVideoFileUrl(video, videoFile, baseUrlHttp) ]

  const magnetHash = {
    xs,
    announce,
    urlList,
    infoHash: videoFile.infoHash,
    name: video.name
  }

  return magnetUtil.encode(magnetHash)
}
