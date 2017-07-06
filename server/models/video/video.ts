import * as safeBuffer from 'safe-buffer'
const Buffer = safeBuffer.Buffer
import * as ffmpeg from 'fluent-ffmpeg'
import * as magnetUtil from 'magnet-uri'
import { map, values } from 'lodash'
import * as parseTorrent from 'parse-torrent'
import { join } from 'path'
import * as Sequelize from 'sequelize'
import * as Promise from 'bluebird'

import { database as db } from '../../initializers/database'
import { TagInstance } from './tag-interface'
import {
  logger,
  isVideoNameValid,
  isVideoCategoryValid,
  isVideoLicenceValid,
  isVideoLanguageValid,
  isVideoNSFWValid,
  isVideoDescriptionValid,
  isVideoInfoHashValid,
  isVideoDurationValid,
  readFileBufferPromise,
  unlinkPromise,
  renamePromise,
  writeFilePromise,
  createTorrentPromise
} from '../../helpers'
import {
  CONSTRAINTS_FIELDS,
  CONFIG,
  REMOTE_SCHEME,
  STATIC_PATHS,
  VIDEO_CATEGORIES,
  VIDEO_LICENCES,
  VIDEO_LANGUAGES,
  THUMBNAILS_SIZE
} from '../../initializers'
import { JobScheduler, removeVideoToFriends } from '../../lib'

import { addMethodsToModel, getSort } from '../utils'
import {
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
    searchAndPopulateAuthorAndPodAndTags,
    removeFromBlacklist
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
    transcodeVideofile
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
  if (video.isOwned()) {
    const videoPath = join(CONFIG.STORAGE.VIDEOS_DIR, video.getVideoFilename())
    const tasks = []

    tasks.push(
      createTorrentFromVideo(video, videoPath),
      createThumbnail(video, videoPath),
      createPreview(video, videoPath)
    )

    if (CONFIG.TRANSCODING.ENABLED === true) {
      const dataInput = {
        id: video.id
      }

      tasks.push(
        JobScheduler.Instance.createJob(options.transaction, 'videoTranscoder', dataInput)
      )
    }

    return Promise.all(tasks)
  }

  return Promise.resolve()
}

function afterDestroy (video: VideoInstance) {
  const tasks = []

  tasks.push(
    removeThumbnail(video)
  )

  if (video.isOwned()) {
    const removeVideoToFriendsParams = {
      remoteId: video.id
    }

    tasks.push(
      removeFile(video),
      removeTorrent(video),
      removePreview(video),
      removeVideoToFriends(removeVideoToFriendsParams)
    )
  }

  return Promise.all(tasks)
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

generateMagnetUri = function (this: VideoInstance) {
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

getVideoFilename = function (this: VideoInstance) {
  if (this.isOwned()) return this.id + this.extname

  return this.remoteId + this.extname
}

getThumbnailName = function (this: VideoInstance) {
  // We always have a copy of the thumbnail
  return this.id + '.jpg'
}

getPreviewName = function (this: VideoInstance) {
  const extension = '.jpg'

  if (this.isOwned()) return this.id + extension

  return this.remoteId + extension
}

getTorrentName = function (this: VideoInstance) {
  const extension = '.torrent'

  if (this.isOwned()) return this.id + extension

  return this.remoteId + extension
}

isOwned = function (this: VideoInstance) {
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
    tags: map<TagInstance, string>(this.Tags, 'name'),
    thumbnailPath: join(STATIC_PATHS.THUMBNAILS, this.getThumbnailName()),
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  }

  return json
}

toAddRemoteJSON = function (this: VideoInstance) {
  // Get thumbnail data to send to the other pod
  const thumbnailPath = join(CONFIG.STORAGE.THUMBNAILS_DIR, this.getThumbnailName())

  return readFileBufferPromise(thumbnailPath).then(thumbnailData => {
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
      tags: map<TagInstance, string>(this.Tags, 'name'),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      extname: this.extname,
      views: this.views,
      likes: this.likes,
      dislikes: this.dislikes
    }

    return remoteVideo
  })
}

toUpdateRemoteJSON = function (this: VideoInstance) {
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
    tags: map<TagInstance, string>(this.Tags, 'name'),
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    extname: this.extname,
    views: this.views,
    likes: this.likes,
    dislikes: this.dislikes
  }

  return json
}

transcodeVideofile = function (this: VideoInstance) {
  const video = this

  const videosDirectory = CONFIG.STORAGE.VIDEOS_DIR
  const newExtname = '.mp4'
  const videoInputPath = join(videosDirectory, video.getVideoFilename())
  const videoOutputPath = join(videosDirectory, video.id + '-transcoded' + newExtname)

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
            video.set('extname', newExtname)

            const newVideoPath = join(videosDirectory, video.getVideoFilename())
            return renamePromise(videoOutputPath, newVideoPath)
          })
          .then(() => {
            const newVideoPath = join(videosDirectory, video.getVideoFilename())
            return createTorrentFromVideo(video, newVideoPath)
          })
          .then(() => {
            return video.save()
          })
          .then(() => {
            return res()
          })
          .catch(err => {
            // Autodesctruction...
            video.destroy().asCallback(function (err) {
              if (err) logger.error('Cannot destruct video after transcoding failure.', { error: err })
            })

            return rej(err)
          })
      })
      .run()
  })
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
    ffmpeg.ffprobe(videoPath, function (err, metadata) {
      if (err) return rej(err)

      return res(Math.floor(metadata.format.duration))
    })
  })
}

list = function () {
  return Video.findAll()
}

listForApi = function (start: number, count: number, sort: string) {
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

  return Video.findAndCountAll(query).then(({ rows, count }) => {
    return {
      data: rows,
      total: count
    }
  })
}

loadByHostAndRemoteId = function (fromHost: string, remoteId: string) {
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

  return Video.findOne(query)
}

listOwnedAndPopulateAuthorAndTags = function () {
  // If remoteId is null this is *our* video
  const query = {
    where: {
      remoteId: null
    },
    include: [ Video['sequelize'].models.Author, Video['sequelize'].models.Tag ]
  }

  return Video.findAll(query)
}

listOwnedByAuthor = function (author: string) {
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

  return Video.findAll(query)
}

load = function (id: string) {
  return Video.findById(id)
}

loadAndPopulateAuthor = function (id: string) {
  const options = {
    include: [ Video['sequelize'].models.Author ]
  }

  return Video.findById(id, options)
}

loadAndPopulateAuthorAndPodAndTags = function (id: string) {
  const options = {
    include: [
      {
        model: Video['sequelize'].models.Author,
        include: [ { model: Video['sequelize'].models.Pod, required: false } ]
      },
      Video['sequelize'].models.Tag
    ]
  }

  return Video.findById(id, options)
}

searchAndPopulateAuthorAndPodAndTags = function (value: string, field: string, start: number, count: number, sort: string) {
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
    authorInclude, tagInclude
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

function removeThumbnail (video: VideoInstance) {
  const thumbnailPath = join(CONFIG.STORAGE.THUMBNAILS_DIR, video.getThumbnailName())
  return unlinkPromise(thumbnailPath)
}

function removeFile (video: VideoInstance) {
  const filePath = join(CONFIG.STORAGE.VIDEOS_DIR, video.getVideoFilename())
  return unlinkPromise(filePath)
}

function removeTorrent (video: VideoInstance) {
  const torrenPath = join(CONFIG.STORAGE.TORRENTS_DIR, video.getTorrentName())
  return unlinkPromise(torrenPath)
}

function removePreview (video: VideoInstance) {
  // Same name than video thumnail
  return unlinkPromise(CONFIG.STORAGE.PREVIEWS_DIR + video.getPreviewName())
}

function createTorrentFromVideo (video: VideoInstance, videoPath: string) {
  const options = {
    announceList: [
      [ CONFIG.WEBSERVER.WS + '://' + CONFIG.WEBSERVER.HOSTNAME + ':' + CONFIG.WEBSERVER.PORT + '/tracker/socket' ]
    ],
    urlList: [
      CONFIG.WEBSERVER.URL + STATIC_PATHS.WEBSEED + video.getVideoFilename()
    ]
  }

  return createTorrentPromise(videoPath, options)
    .then(torrent => {
      const filePath = join(CONFIG.STORAGE.TORRENTS_DIR, video.getTorrentName())
      return writeFilePromise(filePath, torrent).then(() => torrent)
    })
    .then(torrent => {
      const parsedTorrent = parseTorrent(torrent)
      video.set('infoHash', parsedTorrent.infoHash)
      return video.validate()
    })
}

function createPreview (video: VideoInstance, videoPath: string) {
  return generateImage(video, videoPath, CONFIG.STORAGE.PREVIEWS_DIR, video.getPreviewName(), null)
}

function createThumbnail (video: VideoInstance, videoPath: string) {
  return generateImage(video, videoPath, CONFIG.STORAGE.THUMBNAILS_DIR, video.getThumbnailName(), THUMBNAILS_SIZE)
}

function generateImage (video: VideoInstance, videoPath: string, folder: string, imageName: string, size: string) {
  const options: any = {
    filename: imageName,
    count: 1,
    folder
  }

  if (size) {
    options.size = size
  }

  return new Promise<string>((res, rej) => {
    ffmpeg(videoPath)
      .on('error', rej)
      .on('end', function () {
        return res(imageName)
      })
      .thumbnail(options)
  })
}

function removeFromBlacklist (video: VideoInstance) {
  // Find the blacklisted video
  return db.BlacklistedVideo.loadByVideoId(video.id).then(video => {
    // Not found the video, skip
    if (!video) {
      return null
    }

    // If we found the video, remove it from the blacklist
    return video.destroy()
  })
}
