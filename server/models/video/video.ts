import * as safeBuffer from 'safe-buffer'
const Buffer = safeBuffer.Buffer
import * as ffmpeg from 'fluent-ffmpeg'
import * as magnetUtil from 'magnet-uri'
import { map } from 'lodash'
import * as parseTorrent from 'parse-torrent'
import { join } from 'path'
import * as Sequelize from 'sequelize'
import * as Promise from 'bluebird'

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
  statPromise
} from '../../helpers'
import {
  CONFIG,
  REMOTE_SCHEME,
  STATIC_PATHS,
  VIDEO_CATEGORIES,
  VIDEO_LICENCES,
  VIDEO_LANGUAGES,
  THUMBNAILS_SIZE,
  VIDEO_FILE_RESOLUTIONS
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

let Video: Sequelize.Model<VideoInstance, VideoAttributes>
let getOriginalFile: VideoMethods.GetOriginalFile
let generateMagnetUri: VideoMethods.GenerateMagnetUri
let getVideoFilename: VideoMethods.GetVideoFilename
let getThumbnailName: VideoMethods.GetThumbnailName
let getPreviewName: VideoMethods.GetPreviewName
let getTorrentFileName: VideoMethods.GetTorrentFileName
let isOwned: VideoMethods.IsOwned
let toFormattedJSON: VideoMethods.ToFormattedJSON
let toAddRemoteJSON: VideoMethods.ToAddRemoteJSON
let toUpdateRemoteJSON: VideoMethods.ToUpdateRemoteJSON
let optimizeOriginalVideofile: VideoMethods.OptimizeOriginalVideofile
let transcodeOriginalVideofile: VideoMethods.TranscodeOriginalVideofile
let createPreview: VideoMethods.CreatePreview
let createThumbnail: VideoMethods.CreateThumbnail
let getVideoFilePath: VideoMethods.GetVideoFilePath
let createTorrentAndSetInfoHash: VideoMethods.CreateTorrentAndSetInfoHash
let getOriginalFileHeight: VideoMethods.GetOriginalFileHeight

let generateThumbnailFromData: VideoMethods.GenerateThumbnailFromData
let getDurationFromFile: VideoMethods.GetDurationFromFile
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
          fields: [ 'authorId' ]
        },
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
    getDurationFromFile,
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
    generateMagnetUri,
    getPreviewName,
    getThumbnailName,
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
    toUpdateRemoteJSON,
    optimizeOriginalVideofile,
    transcodeOriginalVideofile,
    getOriginalFileHeight
  ]
  addMethodsToModel(Video, classMethods, instanceMethods)

  return Video
}

// ------------------------------ METHODS ------------------------------

function associate (models) {
  Video.belongsTo(models.Author, {
    foreignKey: {
      name: 'authorId',
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
      video.removeFile(file),
      video.removeTorrent(file)
    })
  }

  return Promise.all(tasks)
}

getOriginalFile = function (this: VideoInstance) {
  if (Array.isArray(this.VideoFiles) === false) return undefined

  return this.VideoFiles.find(file => file.resolution === VideoResolution.ORIGINAL)
}

getVideoFilename = function (this: VideoInstance, videoFile: VideoFileInstance) {
  return this.uuid + '-' + VIDEO_FILE_RESOLUTIONS[videoFile.resolution] + videoFile.extname
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
  return this.uuid + '-' + VIDEO_FILE_RESOLUTIONS[videoFile.resolution] + extension
}

isOwned = function (this: VideoInstance) {
  return this.remote === false
}

createPreview = function (this: VideoInstance, videoFile: VideoFileInstance) {
  return generateImage(this, this.getVideoFilePath(videoFile), CONFIG.STORAGE.PREVIEWS_DIR, this.getPreviewName(), null)
}

createThumbnail = function (this: VideoInstance, videoFile: VideoFileInstance) {
  return generateImage(this, this.getVideoFilePath(videoFile), CONFIG.STORAGE.THUMBNAILS_DIR, this.getThumbnailName(), THUMBNAILS_SIZE)
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

generateMagnetUri = function (this: VideoInstance, videoFile: VideoFileInstance) {
  let baseUrlHttp
  let baseUrlWs

  if (this.isOwned()) {
    baseUrlHttp = CONFIG.WEBSERVER.URL
    baseUrlWs = CONFIG.WEBSERVER.WS + '://' + CONFIG.WEBSERVER.HOSTNAME + ':' + CONFIG.WEBSERVER.PORT
  } else {
    baseUrlHttp = REMOTE_SCHEME.HTTP + '://' + this.Author.Pod.host
    baseUrlWs = REMOTE_SCHEME.WS + '://' + this.Author.Pod.host
  }

  const xs = baseUrlHttp + STATIC_PATHS.TORRENTS + this.getTorrentFileName(videoFile)
  const announce = [ baseUrlWs + '/tracker/socket' ]
  const urlList = [ baseUrlHttp + STATIC_PATHS.WEBSEED + this.getVideoFilename(videoFile) ]

  const magnetHash = {
    xs,
    announce,
    urlList,
    infoHash: videoFile.infoHash,
    name: this.name
  }

  return magnetUtil.encode(magnetHash)
}

toFormattedJSON = function (this: VideoInstance) {
  let podHost

  if (this.Author.Pod) {
    podHost = this.Author.Pod.host
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
    author: this.Author.name,
    duration: this.duration,
    views: this.views,
    likes: this.likes,
    dislikes: this.dislikes,
    tags: map<TagInstance, string>(this.Tags, 'name'),
    thumbnailPath: join(STATIC_PATHS.THUMBNAILS, this.getThumbnailName()),
    previewPath: join(STATIC_PATHS.PREVIEWS, this.getPreviewName()),
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    files: []
  }

  // Format and sort video files
  json.files = this.VideoFiles
                   .map(videoFile => {
                     let resolutionLabel = VIDEO_FILE_RESOLUTIONS[videoFile.resolution]
                     if (!resolutionLabel) resolutionLabel = 'Unknown'

                     const videoFileJson = {
                       resolution: videoFile.resolution,
                       resolutionLabel,
                       magnetUri: this.generateMagnetUri(videoFile),
                       size: videoFile.size
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
      author: this.Author.name,
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
    author: this.Author.name,
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

  return new Promise<void>((res, rej) => {
    ffmpeg(videoInputPath)
      .output(videoOutputPath)
      .videoCodec('libx264')
      .outputOption('-threads ' + CONFIG.TRANSCODING.THREADS)
      .outputOption('-movflags faststart')
      .on('error', rej)
      .on('end', () => {

        return unlinkPromise(videoInputPath)
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
            return res()
          })
          .catch(err => {
            // Auto destruction...
            this.destroy().catch(err => logger.error('Cannot destruct video after transcoding failure.', err))

            return rej(err)
          })
      })
      .run()
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
  const resolutionOption = `${resolution}x?` // '720x?' for example

  return new Promise<void>((res, rej) => {
    ffmpeg(videoInputPath)
      .output(videoOutputPath)
      .videoCodec('libx264')
      .size(resolutionOption)
      .outputOption('-threads ' + CONFIG.TRANSCODING.THREADS)
      .outputOption('-movflags faststart')
      .on('error', rej)
      .on('end', () => {
        return statPromise(videoOutputPath)
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
          .then(() => {
            return res()
          })
          .catch(rej)
      })
      .run()
  })
}

getOriginalFileHeight = function (this: VideoInstance) {
  const originalFilePath = this.getVideoFilePath(this.getOriginalFile())

  return new Promise<number>((res, rej) => {
    ffmpeg.ffprobe(originalFilePath, (err, metadata) => {
      if (err) return rej(err)

      const videoStream = metadata.streams.find(s => s.codec_type === 'video')
      return res(videoStream.height)
    })
  })
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

getDurationFromFile = function (videoPath: string) {
  return new Promise<number>((res, rej) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) return rej(err)

      return res(Math.floor(metadata.format.duration))
    })
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
        model: Video['sequelize'].models.Author,
        include: [ { model: Video['sequelize'].models.Pod, required: false } ]
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

loadByHostAndUUID = function (fromHost: string, uuid: string) {
  const query = {
    where: {
      uuid
    },
    include: [
      {
        model: Video['sequelize'].models.VideoFile
      },
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

  return Video.findOne(query)
}

listOwnedAndPopulateAuthorAndTags = function () {
  const query = {
    where: {
      remote: false
    },
    include: [
      Video['sequelize'].models.VideoFile,
      Video['sequelize'].models.Author,
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
        model: Video['sequelize'].models.Author,
        where: {
          name: author
        }
      }
    ]
  }

  return Video.findAll(query)
}

load = function (id: number) {
  return Video.findById(id)
}

loadByUUID = function (uuid: string) {
  const query = {
    where: {
      uuid
    },
    include: [ Video['sequelize'].models.VideoFile ]
  }
  return Video.findOne(query)
}

loadAndPopulateAuthor = function (id: number) {
  const options = {
    include: [ Video['sequelize'].models.VideoFile, Video['sequelize'].models.Author ]
  }

  return Video.findById(id, options)
}

loadAndPopulateAuthorAndPodAndTags = function (id: number) {
  const options = {
    include: [
      {
        model: Video['sequelize'].models.Author,
        include: [ { model: Video['sequelize'].models.Pod, required: false } ]
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
        model: Video['sequelize'].models.Author,
        include: [ { model: Video['sequelize'].models.Pod, required: false } ]
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
    include: [
      podInclude
    ]
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

    // authorInclude.or = true
  } else {
    query.where[field] = {
      $iLike: '%' + value + '%'
    }
  }

  query.include = [
    authorInclude, tagInclude, videoFileInclude
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

function generateImage (video: VideoInstance, videoPath: string, folder: string, imageName: string, size: string) {
  const options = {
    filename: imageName,
    count: 1,
    folder
  }

  if (size) {
    options['size'] = size
  }

  return new Promise<string>((res, rej) => {
    ffmpeg(videoPath)
      .on('error', rej)
      .on('end', () => res(imageName))
      .thumbnail(options)
  })
}
