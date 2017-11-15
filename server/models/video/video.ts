import { map, maxBy, truncate } from 'lodash'
import * as magnetUtil from 'magnet-uri'
import * as parseTorrent from 'parse-torrent'
import { join } from 'path'
import * as safeBuffer from 'safe-buffer'
import * as Sequelize from 'sequelize'
import { VideoPrivacy, VideoResolution } from '../../../shared'
import { VideoTorrentObject } from '../../../shared/models/activitypub/objects/video-torrent-object'
import {
  createTorrentPromise,
  generateImageFromVideoFile,
  getActivityPubUrl,
  getVideoFileHeight,
  isVideoCategoryValid,
  isVideoDescriptionValid,
  isVideoDurationValid,
  isVideoLanguageValid,
  isVideoLicenceValid,
  isVideoNameValid,
  isVideoNSFWValid,
  isVideoPrivacyValid,
  logger,
  renamePromise,
  statPromise,
  transcode,
  unlinkPromise,
  writeFilePromise
} from '../../helpers'
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

import { addMethodsToModel, getSort } from '../utils'

import { TagInstance } from './tag-interface'
import { VideoFileInstance, VideoFileModel } from './video-file-interface'
import { VideoAttributes, VideoInstance, VideoMethods } from './video-interface'
import { sendDeleteVideo } from '../../lib/activitypub/send-request'
import { isVideoUrlValid } from '../../helpers/custom-validators/videos'

const Buffer = safeBuffer.Buffer

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

let generateThumbnailFromData: VideoMethods.GenerateThumbnailFromData
let list: VideoMethods.List
let listForApi: VideoMethods.ListForApi
let listUserVideosForApi: VideoMethods.ListUserVideosForApi
let loadByHostAndUUID: VideoMethods.LoadByHostAndUUID
let listOwnedAndPopulateAccountAndTags: VideoMethods.ListOwnedAndPopulateAccountAndTags
let listOwnedByAccount: VideoMethods.ListOwnedByAccount
let load: VideoMethods.Load
let loadByUUID: VideoMethods.LoadByUUID
let loadByUUIDOrURL: VideoMethods.LoadByUUIDOrURL
let loadLocalVideoByUUID: VideoMethods.LoadLocalVideoByUUID
let loadAndPopulateAccount: VideoMethods.LoadAndPopulateAccount
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
            const res = isVideoUrlValid(value)
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
        },
        {
          fields: [ 'parentId' ]
        }
      ],
      hooks: {
        afterDestroy
      }
    }
  )

  const classMethods = [
    associate,

    generateThumbnailFromData,
    list,
    listForApi,
    listUserVideosForApi,
    listOwnedAndPopulateAccountAndTags,
    listOwnedByAccount,
    load,
    loadAndPopulateAccount,
    loadAndPopulateAccountAndServerAndTags,
    loadByHostAndUUID,
    loadByUUIDOrURL,
    loadByUUID,
    loadLocalVideoByUUID,
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

  Video.belongsTo(models.Video, {
    foreignKey: {
      name: 'parentId',
      allowNull: true
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

  const tag = this.Tags.map(t => ({
    type: 'Hashtag' as 'Hashtag',
    name: t.name
  }))

  const url = []
  for (const file of this.VideoFiles) {
    url.push({
      type: 'Link',
      mimeType: 'video/' + file.extname,
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

  const videoObject: VideoTorrentObject = {
    type: 'Video' as 'Video',
    id: getActivityPubUrl('video', this.uuid),
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
    language: {
      identifier: this.language + '',
      name: this.getLanguageLabel()
    },
    views: this.views,
    nsfw: this.nsfw,
    published: this.createdAt,
    updated: this.updatedAt,
    mediaType: 'text/markdown',
    content: this.getTruncatedDescription(),
    icon: {
      type: 'Image',
      url: getThumbnailUrl(this, baseUrlHttp),
      mediaType: 'image/jpeg',
      width: THUMBNAILS_SIZE.width,
      height: THUMBNAILS_SIZE.height
    },
    url
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

generateThumbnailFromData = function (video: VideoInstance, thumbnailData: string) {
  // Creating the thumbnail for a remote video

  const thumbnailName = video.getThumbnailName()
  const thumbnailPath = join(CONFIG.STORAGE.THUMBNAILS_DIR, thumbnailName)
  return writeFilePromise(thumbnailPath, Buffer.from(thumbnailData, 'binary')).then(() => {
    return thumbnailName
  })
}

list = function () {
  const query = {
    include: [ Video['sequelize'].models.VideoFile ]
  }

  return Video.findAll(query)
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

loadByHostAndUUID = function (fromHost: string, uuid: string, t?: Sequelize.Transaction) {
  const query: Sequelize.FindOptions<VideoAttributes> = {
    where: {
      uuid
    },
    include: [
      {
        model: Video['sequelize'].models.VideoFile
      },
      {
        model: Video['sequelize'].models.VideoChannel,
        include: [
          {
            model: Video['sequelize'].models.Account,
            include: [
              {
                model: Video['sequelize'].models.Server,
                required: true,
                where: {
                  host: fromHost
                }
              }
            ]
          }
        ]
      }
    ]
  }

  if (t !== undefined) query.transaction = t

  return Video.findOne(query)
}

listOwnedAndPopulateAccountAndTags = function () {
  const query = {
    where: {
      remote: false
    },
    include: [
      Video['sequelize'].models.VideoFile,
      {
        model: Video['sequelize'].models.VideoChannel,
        include: [ Video['sequelize'].models.Account ]
      },
      Video['sequelize'].models.Tag
    ]
  }

  return Video.findAll(query)
}

listOwnedByAccount = function (account: string) {
  const query = {
    where: {
      remote: false
    },
    include: [
      {
        model: Video['sequelize'].models.VideoFile
      },
      {
        model: Video['sequelize'].models.VideoChannel,
        include: [
          {
            model: Video['sequelize'].models.Account,
            where: {
              name: account
            }
          }
        ]
      }
    ]
  }

  return Video.findAll(query)
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

loadLocalVideoByUUID = function (uuid: string, t?: Sequelize.Transaction) {
  const query: Sequelize.FindOptions<VideoAttributes> = {
    where: {
      uuid,
      remote: false
    },
    include: [ Video['sequelize'].models.VideoFile ]
  }

  if (t !== undefined) query.transaction = t

  return Video.findOne(query)
}

loadAndPopulateAccount = function (id: number) {
  const options = {
    include: [
      Video['sequelize'].models.VideoFile,
      {
        model: Video['sequelize'].models.VideoChannel,
        include: [ Video['sequelize'].models.Account ]
      }
    ]
  }

  return Video.findById(id, options)
}

loadAndPopulateAccountAndServerAndTags = function (id: number) {
  const options = {
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
      Video['sequelize'].models.Tag,
      Video['sequelize'].models.VideoFile
    ]
  }

  return Video.findById(id, options)
}

loadByUUIDAndPopulateAccountAndServerAndTags = function (uuid: string) {
  const options = {
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
