import * as safeBuffer from 'safe-buffer'
const Buffer = safeBuffer.Buffer
import * as createTorrent from 'create-torrent'
import * as ffmpeg from 'fluent-ffmpeg'
import * as fs from 'fs'
import * as magnetUtil from 'magnet-uri'
import { map, values } from 'lodash'
import { parallel, series } from 'async'
import * as parseTorrent from 'parse-torrent'
import { join } from 'path'
import * as Sequelize from 'sequelize'

import { database as db } from '../initializers/database'
import { VideoTagInstance } from './video-tag-interface'
import {
  logger,
  isVideoNameValid,
  isVideoCategoryValid,
  isVideoLicenceValid,
  isVideoLanguageValid,
  isVideoNSFWValid,
  isVideoDescriptionValid,
  isVideoInfoHashValid,
  isVideoDurationValid
} from '../helpers'
import {
  CONSTRAINTS_FIELDS,
  CONFIG,
  REMOTE_SCHEME,
  STATIC_PATHS,
  VIDEO_CATEGORIES,
  VIDEO_LICENCES,
  VIDEO_LANGUAGES,
  THUMBNAILS_SIZE
} from '../initializers'
import { JobScheduler, removeVideoToFriends } from '../lib'

import { addMethodsToModel, getSort } from './utils'
import {
  VideoClass,
  VideoInstance,
  VideoAttributes,

  VideoMethods
} from './video-interface'

let Video: Sequelize.Model<VideoInstance, VideoAttributes>
let generateMagnetUri: VideoMethods.GenerateMagnetUri
let getVideoFilename: VideoMethods.GetVideoFilename
let getThumbnailName: VideoMethods.GetThumbnailName
let getPreviewName: VideoMethods.GetPreviewName
let getTorrentName: VideoMethods.GetTorrentName
let isOwned: VideoMethods.IsOwned
let toFormatedJSON: VideoMethods.ToFormatedJSON
let toAddRemoteJSON: VideoMethods.ToAddRemoteJSON
let toUpdateRemoteJSON: VideoMethods.ToUpdateRemoteJSON
let transcodeVideofile: VideoMethods.TranscodeVideofile

let generateThumbnailFromData: VideoMethods.GenerateThumbnailFromData
let getDurationFromFile: VideoMethods.GetDurationFromFile
let list: VideoMethods.List
let listForApi: VideoMethods.ListForApi
let loadByHostAndRemoteId: VideoMethods.LoadByHostAndRemoteId
let listOwnedAndPopulateAuthorAndTags: VideoMethods.ListOwnedAndPopulateAuthorAndTags
let listOwnedByAuthor: VideoMethods.ListOwnedByAuthor
let load: VideoMethods.Load
let loadAndPopulateAuthor: VideoMethods.LoadAndPopulateAuthor
let loadAndPopulateAuthorAndPodAndTags: VideoMethods.LoadAndPopulateAuthorAndPodAndTags
let searchAndPopulateAuthorAndPodAndTags: VideoMethods.SearchAndPopulateAuthorAndPodAndTags

export default function (sequelize: Sequelize.Sequelize, DataTypes: Sequelize.DataTypes) {
  Video = sequelize.define<VideoInstance, VideoAttributes>('Video',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        validate: {
          isUUID: 4
        }
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          nameValid: function (value) {
            const res = isVideoNameValid(value)
            if (res === false) throw new Error('Video name is not valid.')
          }
        }
      },
      extname: {
        type: DataTypes.ENUM(values(CONSTRAINTS_FIELDS.VIDEOS.EXTNAME)),
        allowNull: false
      },
      remoteId: {
        type: DataTypes.UUID,
        allowNull: true,
        validate: {
          isUUID: 4
        }
      },
      category: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
          categoryValid: function (value) {
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
          licenceValid: function (value) {
            const res = isVideoLicenceValid(value)
            if (res === false) throw new Error('Video licence is not valid.')
          }
        }
      },
      language: {
        type: DataTypes.INTEGER,
        allowNull: true,
        validate: {
          languageValid: function (value) {
            const res = isVideoLanguageValid(value)
            if (res === false) throw new Error('Video language is not valid.')
          }
        }
      },
      nsfw: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        validate: {
          nsfwValid: function (value) {
            const res = isVideoNSFWValid(value)
            if (res === false) throw new Error('Video nsfw attribute is not valid.')
          }
        }
      },
      description: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          descriptionValid: function (value) {
            const res = isVideoDescriptionValid(value)
            if (res === false) throw new Error('Video description is not valid.')
          }
        }
      },
      infoHash: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          infoHashValid: function (value) {
            const res = isVideoInfoHashValid(value)
            if (res === false) throw new Error('Video info hash is not valid.')
          }
        }
      },
      duration: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
          durationValid: function (value) {
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
      }
    },
    {
      indexes: [
        {
          fields: [ 'authorId' ]
        },
        {
          fields: [ 'remoteId' ]
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
          fields: [ 'infoHash' ]
        },
        {
          fields: [ 'views' ]
        },
        {
          fields: [ 'likes' ]
        }
      ],
      hooks: {
        beforeValidate,
        beforeCreate,
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
    loadByHostAndRemoteId,
    loadAndPopulateAuthor,
    loadAndPopulateAuthorAndPodAndTags,
    searchAndPopulateAuthorAndPodAndTags
  ]
  const instanceMethods = [
    generateMagnetUri,
    getVideoFilename,
    getThumbnailName,
    getPreviewName,
    getTorrentName,
    isOwned,
    toFormatedJSON,
    toAddRemoteJSON,
    toUpdateRemoteJSON,
    transcodeVideofile,
    removeFromBlacklist
  ]
  addMethodsToModel(Video, classMethods, instanceMethods)

  return Video
}

function beforeValidate (video: VideoInstance) {
  // Put a fake infoHash if it does not exists yet
  if (video.isOwned() && !video.infoHash) {
    // 40 hexa length
    video.infoHash = '0123456789abcdef0123456789abcdef01234567'
  }
}

function beforeCreate (video: VideoInstance, options: { transaction: Sequelize.Transaction }) {
  return new Promise(function (resolve, reject) {
    const tasks = []

    if (video.isOwned()) {
      const videoPath = join(CONFIG.STORAGE.VIDEOS_DIR, video.getVideoFilename())

      tasks.push(
        function createVideoTorrent (callback) {
          createTorrentFromVideo(video, videoPath, callback)
        },

        function createVideoThumbnail (callback) {
          createThumbnail(video, videoPath, callback)
        },

        function createVideoPreview (callback) {
          createPreview(video, videoPath, callback)
        }
      )

      if (CONFIG.TRANSCODING.ENABLED === true) {
        tasks.push(
          function createVideoTranscoderJob (callback) {
            const dataInput = {
              id: video.id
            }

            JobScheduler.Instance.createJob(options.transaction, 'videoTranscoder', dataInput, callback)
          }
        )
      }

      return parallel(tasks, function (err) {
        if (err) return reject(err)

        return resolve()
      })
    }

    return resolve()
  })
}

function afterDestroy (video: VideoInstance) {
  return new Promise(function (resolve, reject) {
    const tasks = []

    tasks.push(
      function (callback) {
        removeThumbnail(video, callback)
      }
    )

    if (video.isOwned()) {
      tasks.push(
        function removeVideoFile (callback) {
          removeFile(video, callback)
        },

        function removeVideoTorrent (callback) {
          removeTorrent(video, callback)
        },

        function removeVideoPreview (callback) {
          removePreview(video, callback)
        },

        function notifyFriends (callback) {
          const params = {
            remoteId: video.id
          }

          removeVideoToFriends(params)

          return callback()
        }
      )
    }

    parallel(tasks, function (err) {
      if (err) return reject(err)

      return resolve()
    })
  })
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
}

generateMagnetUri = function () {
  let baseUrlHttp
  let baseUrlWs

  if (this.isOwned()) {
    baseUrlHttp = CONFIG.WEBSERVER.URL
    baseUrlWs = CONFIG.WEBSERVER.WS + '://' + CONFIG.WEBSERVER.HOSTNAME + ':' + CONFIG.WEBSERVER.PORT
  } else {
    baseUrlHttp = REMOTE_SCHEME.HTTP + '://' + this.Author.Pod.host
    baseUrlWs = REMOTE_SCHEME.WS + '://' + this.Author.Pod.host
  }

  const xs = baseUrlHttp + STATIC_PATHS.TORRENTS + this.getTorrentName()
  const announce = [ baseUrlWs + '/tracker/socket' ]
  const urlList = [ baseUrlHttp + STATIC_PATHS.WEBSEED + this.getVideoFilename() ]

  const magnetHash = {
    xs,
    announce,
    urlList,
    infoHash: this.infoHash,
    name: this.name
  }

  return magnetUtil.encode(magnetHash)
}

getVideoFilename = function () {
  if (this.isOwned()) return this.id + this.extname

  return this.remoteId + this.extname
}

getThumbnailName = function () {
  // We always have a copy of the thumbnail
  return this.id + '.jpg'
}

getPreviewName = function () {
  const extension = '.jpg'

  if (this.isOwned()) return this.id + extension

  return this.remoteId + extension
}

getTorrentName = function () {
  const extension = '.torrent'

  if (this.isOwned()) return this.id + extension

  return this.remoteId + extension
}

isOwned = function () {
  return this.remoteId === null
}

toFormatedJSON = function (this: VideoInstance) {
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
    magnetUri: this.generateMagnetUri(),
    author: this.Author.name,
    duration: this.duration,
    views: this.views,
    likes: this.likes,
    dislikes: this.dislikes,
    tags: map<VideoTagInstance, string>(this.Tags, 'name'),
    thumbnailPath: join(STATIC_PATHS.THUMBNAILS, this.getThumbnailName()),
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  }

  return json
}

toAddRemoteJSON = function (callback: VideoMethods.ToAddRemoteJSONCallback) {
  // Get thumbnail data to send to the other pod
  const thumbnailPath = join(CONFIG.STORAGE.THUMBNAILS_DIR, this.getThumbnailName())
  fs.readFile(thumbnailPath, (err, thumbnailData) => {
    if (err) {
      logger.error('Cannot read the thumbnail of the video')
      return callback(err)
    }

    const remoteVideo = {
      name: this.name,
      category: this.category,
      licence: this.licence,
      language: this.language,
      nsfw: this.nsfw,
      description: this.description,
      infoHash: this.infoHash,
      remoteId: this.id,
      author: this.Author.name,
      duration: this.duration,
      thumbnailData: thumbnailData.toString('binary'),
      tags: map<VideoTagInstance, string>(this.Tags, 'name'),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      extname: this.extname,
      views: this.views,
      likes: this.likes,
      dislikes: this.dislikes
    }

    return callback(null, remoteVideo)
  })
}

toUpdateRemoteJSON = function () {
  const json = {
    name: this.name,
    category: this.category,
    licence: this.licence,
    language: this.language,
    nsfw: this.nsfw,
    description: this.description,
    infoHash: this.infoHash,
    remoteId: this.id,
    author: this.Author.name,
    duration: this.duration,
    tags: map<VideoTagInstance, string>(this.Tags, 'name'),
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    extname: this.extname,
    views: this.views,
    likes: this.likes,
    dislikes: this.dislikes
  }

  return json
}

transcodeVideofile = function (finalCallback: VideoMethods.TranscodeVideofileCallback) {
  const video = this

  const videosDirectory = CONFIG.STORAGE.VIDEOS_DIR
  const newExtname = '.mp4'
  const videoInputPath = join(videosDirectory, video.getVideoFilename())
  const videoOutputPath = join(videosDirectory, video.id + '-transcoded' + newExtname)

  ffmpeg(videoInputPath)
    .output(videoOutputPath)
    .videoCodec('libx264')
    .outputOption('-threads ' + CONFIG.TRANSCODING.THREADS)
    .outputOption('-movflags faststart')
    .on('error', finalCallback)
    .on('end', function () {
      series([
        function removeOldFile (callback) {
          fs.unlink(videoInputPath, callback)
        },

        function moveNewFile (callback) {
          // Important to do this before getVideoFilename() to take in account the new file extension
          video.set('extname', newExtname)

          const newVideoPath = join(videosDirectory, video.getVideoFilename())
          fs.rename(videoOutputPath, newVideoPath, callback)
        },

        function torrent (callback) {
          const newVideoPath = join(videosDirectory, video.getVideoFilename())
          createTorrentFromVideo(video, newVideoPath, callback)
        },

        function videoExtension (callback) {
          video.save().asCallback(callback)
        }

      ], function (err: Error) {
        if (err) {
          // Autodesctruction...
          video.destroy().asCallback(function (err) {
            if (err) logger.error('Cannot destruct video after transcoding failure.', { error: err })
          })

          return finalCallback(err)
        }

        return finalCallback(null)
      })
    })
    .run()
}

// ------------------------------ STATICS ------------------------------

generateThumbnailFromData = function (video: VideoInstance, thumbnailData: string, callback: VideoMethods.GenerateThumbnailFromDataCallback) {
  // Creating the thumbnail for a remote video

  const thumbnailName = video.getThumbnailName()
  const thumbnailPath = join(CONFIG.STORAGE.THUMBNAILS_DIR, thumbnailName)
  fs.writeFile(thumbnailPath, Buffer.from(thumbnailData, 'binary'), function (err) {
    if (err) return callback(err)

    return callback(null, thumbnailName)
  })
}

getDurationFromFile = function (videoPath: string, callback: VideoMethods.GetDurationFromFileCallback) {
  ffmpeg.ffprobe(videoPath, function (err, metadata) {
    if (err) return callback(err)

    return callback(null, Math.floor(metadata.format.duration))
  })
}

list = function (callback: VideoMethods.ListCallback) {
  return Video.findAll().asCallback(callback)
}

listForApi = function (start: number, count: number, sort: string, callback: VideoMethods.ListForApiCallback) {
  // Exclude Blakclisted videos from the list
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

      Video['sequelize'].models.Tag
    ],
    where: createBaseVideosWhere()
  }

  return Video.findAndCountAll(query).asCallback(function (err, result) {
    if (err) return callback(err)

    return callback(null, result.rows, result.count)
  })
}

loadByHostAndRemoteId = function (fromHost: string, remoteId: string, callback: VideoMethods.LoadByHostAndRemoteIdCallback) {
  const query = {
    where: {
      remoteId: remoteId
    },
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

  return Video.findOne(query).asCallback(callback)
}

listOwnedAndPopulateAuthorAndTags = function (callback: VideoMethods.ListOwnedAndPopulateAuthorAndTagsCallback) {
  // If remoteId is null this is *our* video
  const query = {
    where: {
      remoteId: null
    },
    include: [ Video['sequelize'].models.Author, Video['sequelize'].models.Tag ]
  }

  return Video.findAll(query).asCallback(callback)
}

listOwnedByAuthor = function (author: string, callback: VideoMethods.ListOwnedByAuthorCallback) {
  const query = {
    where: {
      remoteId: null
    },
    include: [
      {
        model: Video['sequelize'].models.Author,
        where: {
          name: author
        }
      }
    ]
  }

  return Video.findAll(query).asCallback(callback)
}

load = function (id: string, callback: VideoMethods.LoadCallback) {
  return Video.findById(id).asCallback(callback)
}

loadAndPopulateAuthor = function (id: string, callback: VideoMethods.LoadAndPopulateAuthorCallback) {
  const options = {
    include: [ Video['sequelize'].models.Author ]
  }

  return Video.findById(id, options).asCallback(callback)
}

loadAndPopulateAuthorAndPodAndTags = function (id: string, callback: VideoMethods.LoadAndPopulateAuthorAndPodAndTagsCallback) {
  const options = {
    include: [
      {
        model: Video['sequelize'].models.Author,
        include: [ { model: Video['sequelize'].models.Pod, required: false } ]
      },
      Video['sequelize'].models.Tag
    ]
  }

  return Video.findById(id, options).asCallback(callback)
}

searchAndPopulateAuthorAndPodAndTags = function (
  value: string,
  field: string,
  start: number,
  count: number,
  sort: string,
  callback: VideoMethods.SearchAndPopulateAuthorAndPodAndTagsCallback
) {
  const podInclude: any = {
    model: Video['sequelize'].models.Pod,
    required: false
  }

  const authorInclude: any = {
    model: Video['sequelize'].models.Author,
    include: [
      podInclude
    ]
  }

  const tagInclude: any = {
    model: Video['sequelize'].models.Tag
  }

  const query: any = {
    distinct: true,
    where: createBaseVideosWhere(),
    offset: start,
    limit: count,
    order: [ getSort(sort), [ Video['sequelize'].models.Tag, 'name', 'ASC' ] ]
  }

  // Make an exact search with the magnet
  if (field === 'magnetUri') {
    const infoHash = magnetUtil.decode(value).infoHash
    query.where.infoHash = infoHash
  } else if (field === 'tags') {
    const escapedValue = Video['sequelize'].escape('%' + value + '%')
    query.where.id.$in = Video['sequelize'].literal(
      '(SELECT "VideoTags"."videoId" FROM "Tags" INNER JOIN "VideoTags" ON "Tags"."id" = "VideoTags"."tagId" WHERE name LIKE ' + escapedValue + ')'
    )
  } else if (field === 'host') {
    // FIXME: Include our pod? (not stored in the database)
    podInclude.where = {
      host: {
        $like: '%' + value + '%'
      }
    }
    podInclude.required = true
  } else if (field === 'author') {
    authorInclude.where = {
      name: {
        $like: '%' + value + '%'
      }
    }

    // authorInclude.or = true
  } else {
    query.where[field] = {
      $like: '%' + value + '%'
    }
  }

  query.include = [
    authorInclude, tagInclude
  ]

  if (tagInclude.where) {
    // query.include.push([ Video['sequelize'].models.Tag ])
  }

  return Video.findAndCountAll(query).asCallback(function (err, result) {
    if (err) return callback(err)

    return callback(null, result.rows, result.count)
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

function removeThumbnail (video: VideoInstance, callback: (err: Error) => void) {
  const thumbnailPath = join(CONFIG.STORAGE.THUMBNAILS_DIR, video.getThumbnailName())
  fs.unlink(thumbnailPath, callback)
}

function removeFile (video: VideoInstance, callback: (err: Error) => void) {
  const filePath = join(CONFIG.STORAGE.VIDEOS_DIR, video.getVideoFilename())
  fs.unlink(filePath, callback)
}

function removeTorrent (video: VideoInstance, callback: (err: Error) => void) {
  const torrenPath = join(CONFIG.STORAGE.TORRENTS_DIR, video.getTorrentName())
  fs.unlink(torrenPath, callback)
}

function removePreview (video: VideoInstance, callback: (err: Error) => void) {
  // Same name than video thumnail
  fs.unlink(CONFIG.STORAGE.PREVIEWS_DIR + video.getPreviewName(), callback)
}

function createTorrentFromVideo (video: VideoInstance, videoPath: string, callback: (err: Error) => void) {
  const options = {
    announceList: [
      [ CONFIG.WEBSERVER.WS + '://' + CONFIG.WEBSERVER.HOSTNAME + ':' + CONFIG.WEBSERVER.PORT + '/tracker/socket' ]
    ],
    urlList: [
      CONFIG.WEBSERVER.URL + STATIC_PATHS.WEBSEED + video.getVideoFilename()
    ]
  }

  createTorrent(videoPath, options, function (err, torrent) {
    if (err) return callback(err)

    const filePath = join(CONFIG.STORAGE.TORRENTS_DIR, video.getTorrentName())
    fs.writeFile(filePath, torrent, function (err) {
      if (err) return callback(err)

      const parsedTorrent = parseTorrent(torrent)
      video.set('infoHash', parsedTorrent.infoHash)
      video.validate().asCallback(callback)
    })
  })
}

function createPreview (video: VideoInstance, videoPath: string, callback: (err: Error) => void) {
  generateImage(video, videoPath, CONFIG.STORAGE.PREVIEWS_DIR, video.getPreviewName(), null, callback)
}

function createThumbnail (video: VideoInstance, videoPath: string, callback: (err: Error) => void) {
  generateImage(video, videoPath, CONFIG.STORAGE.THUMBNAILS_DIR, video.getThumbnailName(), THUMBNAILS_SIZE, callback)
}

type GenerateImageCallback = (err: Error, imageName: string) => void
function generateImage (video: VideoInstance, videoPath: string, folder: string, imageName: string, size: string, callback?: GenerateImageCallback) {
  const options: any = {
    filename: imageName,
    count: 1,
    folder
  }

  if (size) {
    options.size = size
  }

  ffmpeg(videoPath)
    .on('error', callback)
    .on('end', function () {
      callback(null, imageName)
    })
    .thumbnail(options)
}

function removeFromBlacklist (video: VideoInstance, callback: (err: Error) => void) {
  // Find the blacklisted video
  db.BlacklistedVideo.loadByVideoId(video.id, function (err, video) {
    // If an error occured, stop here
    if (err) {
      logger.error('Error when fetching video from blacklist.', { error: err })
      return callback(err)
    }

    // If we found the video, remove it from the blacklist
    if (video) {
      video.destroy().asCallback(callback)
    } else {
      // If haven't found it, simply ignore it and do nothing
      return callback(null)
    }
  })
}
