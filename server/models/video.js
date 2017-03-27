'use strict'

const Buffer = require('safe-buffer').Buffer
const createTorrent = require('create-torrent')
const ffmpeg = require('fluent-ffmpeg')
const fs = require('fs')
const magnetUtil = require('magnet-uri')
const map = require('lodash/map')
const parallel = require('async/parallel')
const parseTorrent = require('parse-torrent')
const pathUtils = require('path')
const values = require('lodash/values')

const constants = require('../initializers/constants')
const logger = require('../helpers/logger')
const friends = require('../lib/friends')
const modelUtils = require('./utils')
const customVideosValidators = require('../helpers/custom-validators').videos

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
            const res = customVideosValidators.isVideoNameValid(value)
            if (res === false) throw new Error('Video name is not valid.')
          }
        }
      },
      extname: {
        type: DataTypes.ENUM(values(constants.CONSTRAINTS_FIELDS.VIDEOS.EXTNAME)),
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
            const res = customVideosValidators.isVideoCategoryValid(value)
            if (res === false) throw new Error('Video category is not valid.')
          }
        }
      },
      licence: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
          licenceValid: function (value) {
            const res = customVideosValidators.isVideoLicenceValid(value)
            if (res === false) throw new Error('Video licence is not valid.')
          }
        }
      },
      description: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          descriptionValid: function (value) {
            const res = customVideosValidators.isVideoDescriptionValid(value)
            if (res === false) throw new Error('Video description is not valid.')
          }
        }
      },
      infoHash: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          infoHashValid: function (value) {
            const res = customVideosValidators.isVideoInfoHashValid(value)
            if (res === false) throw new Error('Video info hash is not valid.')
          }
        }
      },
      duration: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
          durationValid: function (value) {
            const res = customVideosValidators.isVideoDurationValid(value)
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
        toUpdateRemoteJSON
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
    const videoPath = pathUtils.join(constants.CONFIG.STORAGE.VIDEOS_DIR, video.getVideoFilename())

    tasks.push(
      function createVideoTorrent (callback) {
        const options = {
          announceList: [
            [ constants.CONFIG.WEBSERVER.WS + '://' + constants.CONFIG.WEBSERVER.HOSTNAME + ':' + constants.CONFIG.WEBSERVER.PORT + '/tracker/socket' ]
          ],
          urlList: [
            constants.CONFIG.WEBSERVER.URL + constants.STATIC_PATHS.WEBSEED + video.getVideoFilename()
          ]
        }

        createTorrent(videoPath, options, function (err, torrent) {
          if (err) return callback(err)

          const filePath = pathUtils.join(constants.CONFIG.STORAGE.TORRENTS_DIR, video.getTorrentName())
          fs.writeFile(filePath, torrent, function (err) {
            if (err) return callback(err)

            const parsedTorrent = parseTorrent(torrent)
            video.set('infoHash', parsedTorrent.infoHash)
            video.validate().asCallback(callback)
          })
        })
      },

      function createVideoThumbnail (callback) {
        createThumbnail(video, videoPath, callback)
      },

      function createVIdeoPreview (callback) {
        createPreview(video, videoPath, callback)
      }
    )

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

        friends.removeVideoToFriends(params)

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
  let baseUrlHttp, baseUrlWs

  if (this.isOwned()) {
    baseUrlHttp = constants.CONFIG.WEBSERVER.URL
    baseUrlWs = constants.CONFIG.WEBSERVER.WS + '://' + constants.CONFIG.WEBSERVER.HOSTNAME + ':' + constants.CONFIG.WEBSERVER.PORT
  } else {
    baseUrlHttp = constants.REMOTE_SCHEME.HTTP + '://' + this.Author.Pod.host
    baseUrlWs = constants.REMOTE_SCHEME.WS + '://' + this.Author.Pod.host
  }

  const xs = baseUrlHttp + constants.STATIC_PATHS.TORRENTS + this.getTorrentName()
  const announce = baseUrlWs + '/tracker/socket'
  const urlList = [ baseUrlHttp + constants.STATIC_PATHS.WEBSEED + this.getVideoFilename() ]

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
    podHost = constants.CONFIG.WEBSERVER.HOST
  }

  // Maybe our pod is not up to date and there are new categories since our version
  let categoryLabel = constants.VIDEO_CATEGORIES[this.category]
  if (!categoryLabel) categoryLabel = 'Misc'

  // Maybe our pod is not up to date and there are new licences since our version
  let licenceLabel = constants.VIDEO_LICENCES[this.licence]
  if (!licenceLabel) licenceLabel = 'Unknown'

  const json = {
    id: this.id,
    name: this.name,
    category: this.category,
    categoryLabel,
    licence: this.licence,
    licenceLabel,
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
    thumbnailPath: pathUtils.join(constants.STATIC_PATHS.THUMBNAILS, this.getThumbnailName()),
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  }

  return json
}

function toAddRemoteJSON (callback) {
  const self = this

  // Get thumbnail data to send to the other pod
  const thumbnailPath = pathUtils.join(constants.CONFIG.STORAGE.THUMBNAILS_DIR, this.getThumbnailName())
  fs.readFile(thumbnailPath, function (err, thumbnailData) {
    if (err) {
      logger.error('Cannot read the thumbnail of the video')
      return callback(err)
    }

    const remoteVideo = {
      name: self.name,
      category: self.category,
      licence: self.licence,
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

// ------------------------------ STATICS ------------------------------

function generateThumbnailFromData (video, thumbnailData, callback) {
  // Creating the thumbnail for a remote video

  const thumbnailName = video.getThumbnailName()
  const thumbnailPath = pathUtils.join(constants.CONFIG.STORAGE.THUMBNAILS_DIR, thumbnailName)
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
  const query = {
    offset: start,
    limit: count,
    distinct: true, // For the count, a video can have many tags
    order: [ modelUtils.getSort(sort), [ this.sequelize.models.Tag, 'name', 'ASC' ] ],
    include: [
      {
        model: this.sequelize.models.Author,
        include: [ { model: this.sequelize.models.Pod, required: false } ]
      },

      this.sequelize.models.Tag
    ]
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
  const podInclude = {
    model: this.sequelize.models.Pod,
    required: false
  }

  const authorInclude = {
    model: this.sequelize.models.Author,
    include: [
      podInclude
    ]
  }

  const tagInclude = {
    model: this.sequelize.models.Tag
  }

  const query = {
    where: {},
    offset: start,
    limit: count,
    distinct: true, // For the count, a video can have many tags
    order: [ modelUtils.getSort(sort), [ this.sequelize.models.Tag, 'name', 'ASC' ] ]
  }

  // Make an exact search with the magnet
  if (field === 'magnetUri') {
    const infoHash = magnetUtil.decode(value).infoHash
    query.where.infoHash = infoHash
  } else if (field === 'tags') {
    const escapedValue = this.sequelize.escape('%' + value + '%')
    query.where = {
      id: {
        $in: this.sequelize.literal(
          '(SELECT "VideoTags"."videoId" FROM "Tags" INNER JOIN "VideoTags" ON "Tags"."id" = "VideoTags"."tagId" WHERE name LIKE ' + escapedValue + ')'
        )
      }
    }
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

function removeThumbnail (video, callback) {
  const thumbnailPath = pathUtils.join(constants.CONFIG.STORAGE.THUMBNAILS_DIR, video.getThumbnailName())
  fs.unlink(thumbnailPath, callback)
}

function removeFile (video, callback) {
  const filePath = pathUtils.join(constants.CONFIG.STORAGE.VIDEOS_DIR, video.getVideoFilename())
  fs.unlink(filePath, callback)
}

function removeTorrent (video, callback) {
  const torrenPath = pathUtils.join(constants.CONFIG.STORAGE.TORRENTS_DIR, video.getTorrentName())
  fs.unlink(torrenPath, callback)
}

function removePreview (video, callback) {
  // Same name than video thumnail
  fs.unlink(constants.CONFIG.STORAGE.PREVIEWS_DIR + video.getPreviewName(), callback)
}

function createPreview (video, videoPath, callback) {
  generateImage(video, videoPath, constants.CONFIG.STORAGE.PREVIEWS_DIR, video.getPreviewName(), callback)
}

function createThumbnail (video, videoPath, callback) {
  generateImage(video, videoPath, constants.CONFIG.STORAGE.THUMBNAILS_DIR, video.getThumbnailName(), constants.THUMBNAILS_SIZE, callback)
}

function generateImage (video, videoPath, folder, imageName, size, callback) {
  const options = {
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
