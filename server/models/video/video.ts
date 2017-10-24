import * as safeBuffer from 'safe-buffer'
const Buffer = safeBuffer.Buffer
import * as magnetUtil from 'magnet-uri'
import { map } from 'lodash'
import * as parseTorrent from 'parse-torrent'
import { join } from 'path'
import * as Sequelize from 'sequelize'
import * as Promise from 'bluebird'
import { maxBy } from 'lodash'

import { TagInstance } from './tag-interface'
import {
  logger,
  isVideoNameValid,
  isVideoCategoryValid,
  isVideoLicenceValid,
  isVideoLanguageValid,
  isVideoNSFWValid,
  isVideoDescriptionValid,
  isVideoDurationValid,
  readFileBufferPromise,
  unlinkPromise,
  renamePromise,
  writeFilePromise,
  createTorrentPromise,
  statPromise,
  generateImageFromVideoFile,
  transcode,
  getVideoFileHeight
} from '../../helpers'
import {
  CONFIG,
  REMOTE_SCHEME,
  STATIC_PATHS,
  VIDEO_CATEGORIES,
  VIDEO_LICENCES,
  VIDEO_LANGUAGES,
  THUMBNAILS_SIZE
} from '../../initializers'
import { removeVideoToFriends } from '../../lib'
import { VideoResolution } from '../../../shared'
import { VideoFileInstance, VideoFileModel } from './video-file-interface'

import { addMethodsToModel, getSort } from '../utils'
import {
  VideoInstance,
  VideoAttributes,

  VideoMethods
} from './video-interface'
import { PREVIEWS_SIZE } from '../../initializers/constants'

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
let toAddRemoteJSON: VideoMethods.ToAddRemoteJSON
let toUpdateRemoteJSON: VideoMethods.ToUpdateRemoteJSON
let optimizeOriginalVideofile: VideoMethods.OptimizeOriginalVideofile
let transcodeOriginalVideofile: VideoMethods.TranscodeOriginalVideofile
let createPreview: VideoMethods.CreatePreview
let createThumbnail: VideoMethods.CreateThumbnail
let getVideoFilePath: VideoMethods.GetVideoFilePath
let createTorrentAndSetInfoHash: VideoMethods.CreateTorrentAndSetInfoHash
let getOriginalFileHeight: VideoMethods.GetOriginalFileHeight
let getEmbedPath: VideoMethods.GetEmbedPath

let generateThumbnailFromData: VideoMethods.GenerateThumbnailFromData
let list: VideoMethods.List
let listForApi: VideoMethods.ListForApi
let loadByHostAndUUID: VideoMethods.LoadByHostAndUUID
let listOwnedAndPopulateAuthorAndTags: VideoMethods.ListOwnedAndPopulateAuthorAndTags
let listOwnedByAuthor: VideoMethods.ListOwnedByAuthor
let load: VideoMethods.Load
let loadByUUID: VideoMethods.LoadByUUID
let loadAndPopulateAuthor: VideoMethods.LoadAndPopulateAuthor
let loadAndPopulateAuthorAndPodAndTags: VideoMethods.LoadAndPopulateAuthorAndPodAndTags
let loadByUUIDAndPopulateAuthorAndPodAndTags: VideoMethods.LoadByUUIDAndPopulateAuthorAndPodAndTags
let searchAndPopulateAuthorAndPodAndTags: VideoMethods.SearchAndPopulateAuthorAndPodAndTags
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
        type: DataTypes.STRING,
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

    generateThumbnailFromData,
    list,
    listForApi,
    listOwnedAndPopulateAuthorAndTags,
    listOwnedByAuthor,
    load,
    loadAndPopulateAuthor,
    loadAndPopulateAuthorAndPodAndTags,
    loadByHostAndUUID,
    loadByUUID,
    loadByUUIDAndPopulateAuthorAndPodAndTags,
    searchAndPopulateAuthorAndPodAndTags
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
    toAddRemoteJSON,
    toFormattedJSON,
    toFormattedDetailsJSON,
    toUpdateRemoteJSON,
    optimizeOriginalVideofile,
    transcodeOriginalVideofile,
    getOriginalFileHeight,
    getEmbedPath
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
}

function afterDestroy (video: VideoInstance, options: { transaction: Sequelize.Transaction }) {
  const tasks = []

  tasks.push(
    video.removeThumbnail()
  )

  if (video.isOwned()) {
    const removeVideoToFriendsParams = {
      uuid: video.uuid
    }

    tasks.push(
      video.removePreview(),
      removeVideoToFriends(removeVideoToFriendsParams, options.transaction)
    )

    // Remove physical files and torrents
    video.VideoFiles.forEach(file => {
      tasks.push(video.removeFile(file))
      tasks.push(video.removeTorrent(file))
    })
  }

  return Promise.all(tasks)
    .catch(err => {
      logger.error('Some errors when removing files of video %d in after destroy hook.', video.uuid, err)
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

createTorrentAndSetInfoHash = function (this: VideoInstance, videoFile: VideoFileInstance) {
  const options = {
    announceList: [
      [ CONFIG.WEBSERVER.WS + '://' + CONFIG.WEBSERVER.HOSTNAME + ':' + CONFIG.WEBSERVER.PORT + '/tracker/socket' ]
    ],
    urlList: [
      CONFIG.WEBSERVER.URL + STATIC_PATHS.WEBSEED + this.getVideoFilename(videoFile)
    ]
  }

  return createTorrentPromise(this.getVideoFilePath(videoFile), options)
    .then(torrent => {
      const filePath = join(CONFIG.STORAGE.TORRENTS_DIR, this.getTorrentFileName(videoFile))
      logger.info('Creating torrent %s.', filePath)

      return writeFilePromise(filePath, torrent).then(() => torrent)
    })
    .then(torrent => {
      const parsedTorrent = parseTorrent(torrent)

      videoFile.infoHash = parsedTorrent.infoHash
    })
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
  let podHost

  if (this.VideoChannel.Author.Pod) {
    podHost = this.VideoChannel.Author.Pod.host
  } else {
    // It means it's our video
    podHost = CONFIG.WEBSERVER.HOST
  }

  // Maybe our pod is not up to date and there are new categories since our version
  let categoryLabel = VIDEO_CATEGORIES[this.category]
  if (!categoryLabel) categoryLabel = 'Misc'

  // Maybe our pod is not up to date and there are new licences since our version
  let licenceLabel = VIDEO_LICENCES[this.licence]
  if (!licenceLabel) licenceLabel = 'Unknown'

  // Language is an optional attribute
  let languageLabel = VIDEO_LANGUAGES[this.language]
  if (!languageLabel) languageLabel = 'Unknown'

  const json = {
    id: this.id,
    uuid: this.uuid,
    name: this.name,
    category: this.category,
    categoryLabel,
    licence: this.licence,
    licenceLabel,
    language: this.language,
    languageLabel,
    nsfw: this.nsfw,
    description: this.description,
    podHost,
    isLocal: this.isOwned(),
    author: this.VideoChannel.Author.name,
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
  let podHost

  if (this.VideoChannel.Author.Pod) {
    podHost = this.VideoChannel.Author.Pod.host
  } else {
    // It means it's our video
    podHost = CONFIG.WEBSERVER.HOST
  }

  // Maybe our pod is not up to date and there are new categories since our version
  let categoryLabel = VIDEO_CATEGORIES[this.category]
  if (!categoryLabel) categoryLabel = 'Misc'

  // Maybe our pod is not up to date and there are new licences since our version
  let licenceLabel = VIDEO_LICENCES[this.licence]
  if (!licenceLabel) licenceLabel = 'Unknown'

  // Language is an optional attribute
  let languageLabel = VIDEO_LANGUAGES[this.language]
  if (!languageLabel) languageLabel = 'Unknown'

  const json = {
    id: this.id,
    uuid: this.uuid,
    name: this.name,
    category: this.category,
    categoryLabel,
    licence: this.licence,
    licenceLabel,
    language: this.language,
    languageLabel,
    nsfw: this.nsfw,
    description: this.description,
    podHost,
    isLocal: this.isOwned(),
    author: this.VideoChannel.Author.name,
    duration: this.duration,
    views: this.views,
    likes: this.likes,
    dislikes: this.dislikes,
    tags: map<TagInstance, string>(this.Tags, 'name'),
    thumbnailPath: this.getThumbnailPath(),
    previewPath: this.getPreviewPath(),
    embedPath: this.getEmbedPath(),
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    channel: this.VideoChannel.toFormattedJSON(),
    files: []
  }

  // Format and sort video files
  const { baseUrlHttp, baseUrlWs } = getBaseUrls(this)
  json.files = this.VideoFiles
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

  return json
}

toAddRemoteJSON = function (this: VideoInstance) {
  // Get thumbnail data to send to the other pod
  const thumbnailPath = join(CONFIG.STORAGE.THUMBNAILS_DIR, this.getThumbnailName())

  return readFileBufferPromise(thumbnailPath).then(thumbnailData => {
    const remoteVideo = {
      uuid: this.uuid,
      name: this.name,
      category: this.category,
      licence: this.licence,
      language: this.language,
      nsfw: this.nsfw,
      description: this.description,
      channelUUID: this.VideoChannel.uuid,
      duration: this.duration,
      thumbnailData: thumbnailData.toString('binary'),
      tags: map<TagInstance, string>(this.Tags, 'name'),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      views: this.views,
      likes: this.likes,
      dislikes: this.dislikes,
      files: []
    }

    this.VideoFiles.forEach(videoFile => {
      remoteVideo.files.push({
        infoHash: videoFile.infoHash,
        resolution: videoFile.resolution,
        extname: videoFile.extname,
        size: videoFile.size
      })
    })

    return remoteVideo
  })
}

toUpdateRemoteJSON = function (this: VideoInstance) {
  const json = {
    uuid: this.uuid,
    name: this.name,
    category: this.category,
    licence: this.licence,
    language: this.language,
    nsfw: this.nsfw,
    description: this.description,
    duration: this.duration,
    tags: map<TagInstance, string>(this.Tags, 'name'),
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    views: this.views,
    likes: this.likes,
    dislikes: this.dislikes,
    files: []
  }

  this.VideoFiles.forEach(videoFile => {
    json.files.push({
      infoHash: videoFile.infoHash,
      resolution: videoFile.resolution,
      extname: videoFile.extname,
      size: videoFile.size
    })
  })

  return json
}

optimizeOriginalVideofile = function (this: VideoInstance) {
  const videosDirectory = CONFIG.STORAGE.VIDEOS_DIR
  const newExtname = '.mp4'
  const inputVideoFile = this.getOriginalFile()
  const videoInputPath = join(videosDirectory, this.getVideoFilename(inputVideoFile))
  const videoOutputPath = join(videosDirectory, this.id + '-transcoded' + newExtname)

  const transcodeOptions = {
    inputPath: videoInputPath,
    outputPath: videoOutputPath
  }

  return transcode(transcodeOptions)
    .then(() => {
      return unlinkPromise(videoInputPath)
    })
    .then(() => {
      // Important to do this before getVideoFilename() to take in account the new file extension
      inputVideoFile.set('extname', newExtname)

      return renamePromise(videoOutputPath, this.getVideoFilePath(inputVideoFile))
    })
    .then(() => {
      return statPromise(this.getVideoFilePath(inputVideoFile))
    })
    .then(stats => {
      return inputVideoFile.set('size', stats.size)
    })
    .then(() => {
      return this.createTorrentAndSetInfoHash(inputVideoFile)
    })
    .then(() => {
      return inputVideoFile.save()
    })
    .then(() => {
      return undefined
    })
    .catch(err => {
      // Auto destruction...
      this.destroy().catch(err => logger.error('Cannot destruct video after transcoding failure.', err))

      throw err
    })
}

transcodeOriginalVideofile = function (this: VideoInstance, resolution: VideoResolution) {
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
  return transcode(transcodeOptions)
    .then(() => {
      return statPromise(videoOutputPath)
    })
    .then(stats => {
      newVideoFile.set('size', stats.size)

      return undefined
    })
    .then(() => {
      return this.createTorrentAndSetInfoHash(newVideoFile)
    })
    .then(() => {
      return newVideoFile.save()
    })
    .then(() => {
      return this.VideoFiles.push(newVideoFile)
    })
    .then(() => undefined)
}

getOriginalFileHeight = function (this: VideoInstance) {
  const originalFilePath = this.getVideoFilePath(this.getOriginalFile())

  return getVideoFileHeight(originalFilePath)
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

listForApi = function (start: number, count: number, sort: string) {
  // Exclude blacklisted videos from the list
  const query = {
    distinct: true,
    offset: start,
    limit: count,
    order: [ getSort(sort), [ Video['sequelize'].models.Tag, 'name', 'ASC' ] ],
    include: [
      {
        model: Video['sequelize'].models.VideoChannel,
        include: [
          {
            model: Video['sequelize'].models.Author,
            include: [
              {
                model: Video['sequelize'].models.Pod,
                required: false
              }
            ]
          }
        ]
      },
      Video['sequelize'].models.Tag,
      Video['sequelize'].models.VideoFile
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
            model: Video['sequelize'].models.Author,
            include: [
              {
                model: Video['sequelize'].models.Pod,
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

listOwnedAndPopulateAuthorAndTags = function () {
  const query = {
    where: {
      remote: false
    },
    include: [
      Video['sequelize'].models.VideoFile,
      {
        model: Video['sequelize'].models.VideoChannel,
        include: [ Video['sequelize'].models.Author ]
      },
      Video['sequelize'].models.Tag
    ]
  }

  return Video.findAll(query)
}

listOwnedByAuthor = function (author: string) {
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
            model: Video['sequelize'].models.Author,
            where: {
              name: author
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

loadAndPopulateAuthor = function (id: number) {
  const options = {
    include: [
      Video['sequelize'].models.VideoFile,
      {
        model: Video['sequelize'].models.VideoChannel,
        include: [ Video['sequelize'].models.Author ]
      }
    ]
  }

  return Video.findById(id, options)
}

loadAndPopulateAuthorAndPodAndTags = function (id: number) {
  const options = {
    include: [
      {
        model: Video['sequelize'].models.VideoChannel,
        include: [
          {
            model: Video['sequelize'].models.Author,
            include: [ { model: Video['sequelize'].models.Pod, required: false } ]
          }
        ]
      },
      Video['sequelize'].models.Tag,
      Video['sequelize'].models.VideoFile
    ]
  }

  return Video.findById(id, options)
}

loadByUUIDAndPopulateAuthorAndPodAndTags = function (uuid: string) {
  const options = {
    where: {
      uuid
    },
    include: [
      {
        model: Video['sequelize'].models.VideoChannel,
        include: [
          {
            model: Video['sequelize'].models.Author,
            include: [ { model: Video['sequelize'].models.Pod, required: false } ]
          }
        ]
      },
      Video['sequelize'].models.Tag,
      Video['sequelize'].models.VideoFile
    ]
  }

  return Video.findOne(options)
}

searchAndPopulateAuthorAndPodAndTags = function (value: string, field: string, start: number, count: number, sort: string) {
  const podInclude: Sequelize.IncludeOptions = {
    model: Video['sequelize'].models.Pod,
    required: false
  }

  const authorInclude: Sequelize.IncludeOptions = {
    model: Video['sequelize'].models.Author,
    include: [ podInclude ]
  }

  const videoChannelInclude: Sequelize.IncludeOptions = {
    model: Video['sequelize'].models.VideoChannel,
    include: [ authorInclude ],
    required: true
  }

  const tagInclude: Sequelize.IncludeOptions = {
    model: Video['sequelize'].models.Tag
  }

  const videoFileInclude: Sequelize.IncludeOptions = {
    model: Video['sequelize'].models.VideoFile
  }

  const query: Sequelize.FindOptions<VideoAttributes> = {
    distinct: true,
    where: createBaseVideosWhere(),
    offset: start,
    limit: count,
    order: [ getSort(sort), [ Video['sequelize'].models.Tag, 'name', 'ASC' ] ]
  }

  // Make an exact search with the magnet
  if (field === 'magnetUri') {
    videoFileInclude.where = {
      infoHash: magnetUtil.decode(value).infoHash
    }
  } else if (field === 'tags') {
    const escapedValue = Video['sequelize'].escape('%' + value + '%')
    query.where['id'].$in = Video['sequelize'].literal(
      `(SELECT "VideoTags"."videoId"
        FROM "Tags"
        INNER JOIN "VideoTags" ON "Tags"."id" = "VideoTags"."tagId"
        WHERE name ILIKE ${escapedValue}
       )`
    )
  } else if (field === 'host') {
    // FIXME: Include our pod? (not stored in the database)
    podInclude.where = {
      host: {
        $iLike: '%' + value + '%'
      }
    }
    podInclude.required = true
  } else if (field === 'author') {
    authorInclude.where = {
      name: {
        $iLike: '%' + value + '%'
      }
    }
  } else {
    query.where[field] = {
      $iLike: '%' + value + '%'
    }
  }

  query.include = [
    videoChannelInclude, tagInclude, videoFileInclude
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
      $notIn: Video['sequelize'].literal(
        '(SELECT "BlacklistedVideos"."videoId" FROM "BlacklistedVideos")'
      )
    }
  }
}

function getBaseUrls (video: VideoInstance) {
  let baseUrlHttp
  let baseUrlWs

  if (video.isOwned()) {
    baseUrlHttp = CONFIG.WEBSERVER.URL
    baseUrlWs = CONFIG.WEBSERVER.WS + '://' + CONFIG.WEBSERVER.HOSTNAME + ':' + CONFIG.WEBSERVER.PORT
  } else {
    baseUrlHttp = REMOTE_SCHEME.HTTP + '://' + video.VideoChannel.Author.Pod.host
    baseUrlWs = REMOTE_SCHEME.WS + '://' + video.VideoChannel.Author.Pod.host
  }

  return { baseUrlHttp, baseUrlWs }
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
