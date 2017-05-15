import safeBuffer = require('safe-buffer')
const Buffer = safeBuffer.Buffer
import createTorrent = require('create-torrent')
import ffmpeg = require('fluent-ffmpeg')
import fs = require('fs')
import magnetUtil = require('magnet-uri')
import { map, values } from 'lodash'
import { parallel, series } from 'async'
import parseTorrent = require('parse-torrent')
import { join } from 'path'

const db = require('../initializers/database')
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
import { getSort } from './utils'

// ---------------------------------------------------------------------------

module.exports = function (sequelize, DataTypes) {
  const Video = sequelize.define('Video',
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
      classMethods: {
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
      },
      instanceMethods: {
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
      },
      hooks: {
        beforeValidate,
        beforeCreate,
        afterDestroy
      }
    }
  )

  return Video
}

function beforeValidate (video, options, next) {
  // Put a fake infoHash if it does not exists yet
  if (video.isOwned() && !video.infoHash) {
    // 40 hexa length
    video.infoHash = '0123456789abcdef0123456789abcdef01234567'
  }

  return next(null)
}

function beforeCreate (video, options, next) {
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

    return parallel(tasks, next)
  }

  return next()
}

function afterDestroy (video, options, next) {
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

      function removeVideoToFriends (callback) {
        const params = {
          remoteId: video.id
        }

        removeVideoToFriends(params)

        return callback()
      }
    )
  }

  parallel(tasks, next)
}

// ------------------------------ METHODS ------------------------------

function associate (models) {
  this.belongsTo(models.Author, {
    foreignKey: {
      name: 'authorId',
      allowNull: false
    },
    onDelete: 'cascade'
  })

  this.belongsToMany(models.Tag, {
    foreignKey: 'videoId',
    through: models.VideoTag,
    onDelete: 'cascade'
  })

  this.hasMany(models.VideoAbuse, {
    foreignKey: {
      name: 'videoId',
      allowNull: false
    },
    onDelete: 'cascade'
  })
}

function generateMagnetUri () {
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
  const announce = baseUrlWs + '/tracker/socket'
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

function getVideoFilename () {
  if (this.isOwned()) return this.id + this.extname

  return this.remoteId + this.extname
}

function getThumbnailName () {
  // We always have a copy of the thumbnail
  return this.id + '.jpg'
}

function getPreviewName () {
  const extension = '.jpg'

  if (this.isOwned()) return this.id + extension

  return this.remoteId + extension
}

function getTorrentName () {
  const extension = '.torrent'

  if (this.isOwned()) return this.id + extension

  return this.remoteId + extension
}

function isOwned () {
  return this.remoteId === null
}

function toFormatedJSON () {
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
    tags: map(this.Tags, 'name'),
    thumbnailPath: join(STATIC_PATHS.THUMBNAILS, this.getThumbnailName()),
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  }

  return json
}

function toAddRemoteJSON (callback) {
  const self = this

  // Get thumbnail data to send to the other pod
  const thumbnailPath = join(CONFIG.STORAGE.THUMBNAILS_DIR, this.getThumbnailName())
  fs.readFile(thumbnailPath, function (err, thumbnailData) {
    if (err) {
      logger.error('Cannot read the thumbnail of the video')
      return callback(err)
    }

    const remoteVideo = {
      name: self.name,
      category: self.category,
      licence: self.licence,
      language: self.language,
      nsfw: self.nsfw,
      description: self.description,
      infoHash: self.infoHash,
      remoteId: self.id,
      author: self.Author.name,
      duration: self.duration,
      thumbnailData: thumbnailData.toString('binary'),
      tags: map(self.Tags, 'name'),
      createdAt: self.createdAt,
      updatedAt: self.updatedAt,
      extname: self.extname,
      views: self.views,
      likes: self.likes,
      dislikes: self.dislikes
    }

    return callback(null, remoteVideo)
  })
}

function toUpdateRemoteJSON (callback) {
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
    tags: map(this.Tags, 'name'),
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    extname: this.extname,
    views: this.views,
    likes: this.likes,
    dislikes: this.dislikes
  }

  return json
}

function transcodeVideofile (finalCallback) {
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

      ], function (err) {
        if (err) {
          // Autodescruction...
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

function generateThumbnailFromData (video, thumbnailData, callback) {
  // Creating the thumbnail for a remote video

  const thumbnailName = video.getThumbnailName()
  const thumbnailPath = join(CONFIG.STORAGE.THUMBNAILS_DIR, thumbnailName)
  fs.writeFile(thumbnailPath, Buffer.from(thumbnailData, 'binary'), function (err) {
    if (err) return callback(err)

    return callback(null, thumbnailName)
  })
}

function getDurationFromFile (videoPath, callback) {
  ffmpeg.ffprobe(videoPath, function (err, metadata) {
    if (err) return callback(err)

    return callback(null, Math.floor(metadata.format.duration))
  })
}

function list (callback) {
  return this.findAll().asCallback(callback)
}

function listForApi (start, count, sort, callback) {
  // Exclude Blakclisted videos from the list
  const query = {
    offset: start,
    limit: count,
    distinct: true, // For the count, a video can have many tags
    order: [ getSort(sort), [ this.sequelize.models.Tag, 'name', 'ASC' ] ],
    include: [
      {
        model: this.sequelize.models.Author,
        include: [ { model: this.sequelize.models.Pod, required: false } ]
      },

      this.sequelize.models.Tag
    ],
    where: createBaseVideosWhere.call(this)
  }

  return this.findAndCountAll(query).asCallback(function (err, result) {
    if (err) return callback(err)

    return callback(null, result.rows, result.count)
  })
}

function loadByHostAndRemoteId (fromHost, remoteId, callback) {
  const query = {
    where: {
      remoteId: remoteId
    },
    include: [
      {
        model: this.sequelize.models.Author,
        include: [
          {
            model: this.sequelize.models.Pod,
            required: true,
            where: {
              host: fromHost
            }
          }
        ]
      }
    ]
  }

  return this.findOne(query).asCallback(callback)
}

function listOwnedAndPopulateAuthorAndTags (callback) {
  // If remoteId is null this is *our* video
  const query = {
    where: {
      remoteId: null
    },
    include: [ this.sequelize.models.Author, this.sequelize.models.Tag ]
  }

  return this.findAll(query).asCallback(callback)
}

function listOwnedByAuthor (author, callback) {
  const query = {
    where: {
      remoteId: null
    },
    include: [
      {
        model: this.sequelize.models.Author,
        where: {
          name: author
        }
      }
    ]
  }

  return this.findAll(query).asCallback(callback)
}

function load (id, callback) {
  return this.findById(id).asCallback(callback)
}

function loadAndPopulateAuthor (id, callback) {
  const options = {
    include: [ this.sequelize.models.Author ]
  }

  return this.findById(id, options).asCallback(callback)
}

function loadAndPopulateAuthorAndPodAndTags (id, callback) {
  const options = {
    include: [
      {
        model: this.sequelize.models.Author,
        include: [ { model: this.sequelize.models.Pod, required: false } ]
      },
      this.sequelize.models.Tag
    ]
  }

  return this.findById(id, options).asCallback(callback)
}

function searchAndPopulateAuthorAndPodAndTags (value, field, start, count, sort, callback) {
  const podInclude: any = {
    model: this.sequelize.models.Pod,
    required: false
  }

  const authorInclude: any = {
    model: this.sequelize.models.Author,
    include: [
      podInclude
    ]
  }

  const tagInclude: any = {
    model: this.sequelize.models.Tag
  }

  const query: any = {
    where: createBaseVideosWhere.call(this),
    offset: start,
    limit: count,
    distinct: true, // For the count, a video can have many tags
    order: [ getSort(sort), [ this.sequelize.models.Tag, 'name', 'ASC' ] ]
  }

  // Make an exact search with the magnet
  if (field === 'magnetUri') {
    const infoHash = magnetUtil.decode(value).infoHash
    query.where.infoHash = infoHash
  } else if (field === 'tags') {
    const escapedValue = this.sequelize.escape('%' + value + '%')
    query.where.id.$in = this.sequelize.literal(
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
    // query.include.push([ this.sequelize.models.Tag ])
  }

  return this.findAndCountAll(query).asCallback(function (err, result) {
    if (err) return callback(err)

    return callback(null, result.rows, result.count)
  })
}

// ---------------------------------------------------------------------------

function createBaseVideosWhere () {
  return {
    id: {
      $notIn: this.sequelize.literal(
        '(SELECT "BlacklistedVideos"."videoId" FROM "BlacklistedVideos")'
      )
    }
  }
}

function removeThumbnail (video, callback) {
  const thumbnailPath = join(CONFIG.STORAGE.THUMBNAILS_DIR, video.getThumbnailName())
  fs.unlink(thumbnailPath, callback)
}

function removeFile (video, callback) {
  const filePath = join(CONFIG.STORAGE.VIDEOS_DIR, video.getVideoFilename())
  fs.unlink(filePath, callback)
}

function removeTorrent (video, callback) {
  const torrenPath = join(CONFIG.STORAGE.TORRENTS_DIR, video.getTorrentName())
  fs.unlink(torrenPath, callback)
}

function removePreview (video, callback) {
  // Same name than video thumnail
  fs.unlink(CONFIG.STORAGE.PREVIEWS_DIR + video.getPreviewName(), callback)
}

function createTorrentFromVideo (video, videoPath, callback) {
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

function createPreview (video, videoPath, callback) {
  generateImage(video, videoPath, CONFIG.STORAGE.PREVIEWS_DIR, video.getPreviewName(), callback)
}

function createThumbnail (video, videoPath, callback) {
  generateImage(video, videoPath, CONFIG.STORAGE.THUMBNAILS_DIR, video.getThumbnailName(), THUMBNAILS_SIZE, callback)
}

function generateImage (video, videoPath, folder, imageName, size, callback?) {
  const options: any = {
    filename: imageName,
    count: 1,
    folder
  }

  if (!callback) {
    callback = size
  } else {
    options.size = size
  }

  ffmpeg(videoPath)
    .on('error', callback)
    .on('end', function () {
      callback(null, imageName)
    })
    .thumbnail(options)
}

function removeFromBlacklist (video, callback) {
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
      return callback()
    }
  })
}
