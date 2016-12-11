'use strict'

const createTorrent = require('create-torrent')
const ffmpeg = require('fluent-ffmpeg')
const fs = require('fs')
const magnetUtil = require('magnet-uri')
const parallel = require('async/parallel')
const parseTorrent = require('parse-torrent')
const pathUtils = require('path')

const constants = require('../initializers/constants')
const logger = require('../helpers/logger')
const modelUtils = require('./utils')

// ---------------------------------------------------------------------------

module.exports = function (sequelize, DataTypes) {
// TODO: add indexes on searchable columns
  const Video = sequelize.define('Video',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      name: {
        type: DataTypes.STRING
      },
      extname: {
        // TODO: enum?
        type: DataTypes.STRING
      },
      remoteId: {
        type: DataTypes.UUID
      },
      description: {
        type: DataTypes.STRING
      },
      infoHash: {
        type: DataTypes.STRING
      },
      duration: {
        type: DataTypes.INTEGER
      },
      tags: {
        type: DataTypes.ARRAY(DataTypes.STRING)
      }
    },
    {
      classMethods: {
        associate,

        generateThumbnailFromBase64,
        getDurationFromFile,
        listForApi,
        listByHostAndRemoteId,
        listOwnedAndPopulateAuthor,
        listOwnedByAuthor,
        load,
        loadAndPopulateAuthor,
        loadAndPopulateAuthorAndPod,
        searchAndPopulateAuthorAndPod
      },
      instanceMethods: {
        generateMagnetUri,
        getVideoFilename,
        getThumbnailName,
        getPreviewName,
        getTorrentName,
        isOwned,
        toFormatedJSON,
        toRemoteJSON
      },
      hooks: {
        beforeCreate,
        afterDestroy
      }
    }
  )

  return Video
}

// TODO: Validation
// VideoSchema.path('name').validate(customVideosValidators.isVideoNameValid)
// VideoSchema.path('description').validate(customVideosValidators.isVideoDescriptionValid)
// VideoSchema.path('podHost').validate(customVideosValidators.isVideoPodHostValid)
// VideoSchema.path('author').validate(customVideosValidators.isVideoAuthorValid)
// VideoSchema.path('duration').validate(customVideosValidators.isVideoDurationValid)
// VideoSchema.path('tags').validate(customVideosValidators.isVideoTagsValid)

function beforeCreate (video, options, next) {
  const tasks = []

  if (video.isOwned()) {
    const videoPath = pathUtils.join(constants.CONFIG.STORAGE.VIDEOS_DIR, video.getVideoFilename())

    tasks.push(
      // TODO: refractoring
      function (callback) {
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

          fs.writeFile(constants.CONFIG.STORAGE.TORRENTS_DIR + video.getTorrentName(), torrent, function (err) {
            if (err) return callback(err)

            const parsedTorrent = parseTorrent(torrent)
            video.infoHash = parsedTorrent.infoHash

            callback(null)
          })
        })
      },
      function (callback) {
        createThumbnail(video, videoPath, callback)
      },
      function (callback) {
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
      function (callback) {
        removeFile(video, callback)
      },
      function (callback) {
        removeTorrent(video, callback)
      },
      function (callback) {
        removePreview(video, callback)
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

  const json = {
    id: this.id,
    name: this.name,
    description: this.description,
    podHost,
    isLocal: this.isOwned(),
    magnetUri: this.generateMagnetUri(),
    author: this.Author.name,
    duration: this.duration,
    tags: this.tags,
    thumbnailPath: constants.STATIC_PATHS.THUMBNAILS + '/' + this.getThumbnailName(),
    createdAt: this.createdAt
  }

  return json
}

function toRemoteJSON (callback) {
  const self = this

  // Convert thumbnail to base64
  const thumbnailPath = pathUtils.join(constants.CONFIG.STORAGE.THUMBNAILS_DIR, this.getThumbnailName())
  fs.readFile(thumbnailPath, function (err, thumbnailData) {
    if (err) {
      logger.error('Cannot read the thumbnail of the video')
      return callback(err)
    }

    const remoteVideo = {
      name: self.name,
      description: self.description,
      infoHash: self.infoHash,
      remoteId: self.id,
      author: self.Author.name,
      duration: self.duration,
      thumbnailBase64: new Buffer(thumbnailData).toString('base64'),
      tags: self.tags,
      createdAt: self.createdAt,
      extname: self.extname
    }

    return callback(null, remoteVideo)
  })
}

// ------------------------------ STATICS ------------------------------

function generateThumbnailFromBase64 (video, thumbnailData, callback) {
  // Creating the thumbnail for a remote video

  const thumbnailName = video.getThumbnailName()
  const thumbnailPath = constants.CONFIG.STORAGE.THUMBNAILS_DIR + thumbnailName
  fs.writeFile(thumbnailPath, thumbnailData, { encoding: 'base64' }, function (err) {
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

function listForApi (start, count, sort, callback) {
  const query = {
    offset: start,
    limit: count,
    order: [ modelUtils.getSort(sort) ],
    include: [
      {
        model: this.sequelize.models.Author,
        include: [ this.sequelize.models.Pod ]
      }
    ]
  }

  return this.findAndCountAll(query).asCallback(function (err, result) {
    if (err) return callback(err)

    return callback(null, result.rows, result.count)
  })
}

function listByHostAndRemoteId (fromHost, remoteId, callback) {
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
            where: {
              host: fromHost
            }
          }
        ]
      }
    ]
  }

  return this.findAll(query).asCallback(callback)
}

function listOwnedAndPopulateAuthor (callback) {
  // If remoteId is null this is *our* video
  const query = {
    where: {
      remoteId: null
    },
    include: [ this.sequelize.models.Author ]
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

function loadAndPopulateAuthorAndPod (id, callback) {
  const options = {
    include: [
      {
        model: this.sequelize.models.Author,
        include: [ this.sequelize.models.Pod ]
      }
    ]
  }

  return this.findById(id, options).asCallback(callback)
}

function searchAndPopulateAuthorAndPod (value, field, start, count, sort, callback) {
  const podInclude = {
    model: this.sequelize.models.Pod
  }
  const authorInclude = {
    model: this.sequelize.models.Author,
    include: [
      podInclude
    ]
  }

  const query = {
    where: {},
    include: [
      authorInclude
    ],
    offset: start,
    limit: count,
    order: [ modelUtils.getSort(sort) ]
  }

  // TODO: include our pod for podHost searches (we are not stored in the database)
  // Make an exact search with the magnet
  if (field === 'magnetUri') {
    const infoHash = magnetUtil.decode(value).infoHash
    query.where.infoHash = infoHash
  } else if (field === 'tags') {
    query.where[field] = value
  } else if (field === 'host') {
    const whereQuery = {
      '$Author.Pod.host$': {
        $like: '%' + value + '%'
      }
    }

    // Include our pod? (not stored in the database)
    if (constants.CONFIG.WEBSERVER.HOST.indexOf(value) !== -1) {
      query.where = {
        $or: [
          whereQuery,
          {
            remoteId: null
          }
        ]
      }
    } else {
      query.where = whereQuery
    }
  } else if (field === 'author') {
    query.where = {
      '$Author.name$': {
        $like: '%' + value + '%'
      }
    }
  } else {
    query.where[field] = {
      $like: '%' + value + '%'
    }
  }

  return this.findAndCountAll(query).asCallback(function (err, result) {
    if (err) return callback(err)

    return callback(null, result.rows, result.count)
  })
}

// ---------------------------------------------------------------------------

function removeThumbnail (video, callback) {
  fs.unlink(constants.CONFIG.STORAGE.THUMBNAILS_DIR + video.getThumbnailName(), callback)
}

function removeFile (video, callback) {
  fs.unlink(constants.CONFIG.STORAGE.VIDEOS_DIR + video.getVideoFilename(), callback)
}

function removeTorrent (video, callback) {
  fs.unlink(constants.CONFIG.STORAGE.TORRENTS_DIR + video.getTorrentName(), callback)
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
