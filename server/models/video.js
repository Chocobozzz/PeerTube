'use strict'

const createTorrent = require('create-torrent')
const ffmpeg = require('fluent-ffmpeg')
const fs = require('fs')
const parallel = require('async/parallel')
const parseTorrent = require('parse-torrent')
const pathUtils = require('path')
const magnet = require('magnet-uri')
const mongoose = require('mongoose')

const constants = require('../initializers/constants')
const customVideosValidators = require('../helpers/custom-validators').videos
const logger = require('../helpers/logger')
const modelUtils = require('./utils')
const utils = require('../helpers/utils')

// ---------------------------------------------------------------------------

// TODO: add indexes on searchable columns
const VideoSchema = mongoose.Schema({
  name: String,
  filename: String,
  description: String,
  magnetUri: String,
  podUrl: String,
  author: String,
  duration: Number,
  thumbnail: String,
  tags: [ String ],
  createdDate: {
    type: Date,
    default: Date.now
  }
})

VideoSchema.path('name').validate(customVideosValidators.isVideoNameValid)
VideoSchema.path('description').validate(customVideosValidators.isVideoDescriptionValid)
VideoSchema.path('magnetUri').validate(customVideosValidators.isVideoMagnetUriValid)
VideoSchema.path('podUrl').validate(customVideosValidators.isVideoPodUrlValid)
VideoSchema.path('author').validate(customVideosValidators.isVideoAuthorValid)
VideoSchema.path('duration').validate(customVideosValidators.isVideoDurationValid)
// The tumbnail can be the path or the data in base 64
// The pre save hook will convert the base 64 data in a file on disk and replace the thumbnail key by the filename
VideoSchema.path('thumbnail').validate(function (value) {
  return customVideosValidators.isVideoThumbnailValid(value) || customVideosValidators.isVideoThumbnail64Valid(value)
})
VideoSchema.path('tags').validate(customVideosValidators.isVideoTagsValid)

VideoSchema.methods = {
  isOwned,
  toFormatedJSON,
  toRemoteJSON
}

VideoSchema.statics = {
  getDurationFromFile,
  listForApi,
  listByUrlAndMagnet,
  listByUrls,
  listOwned,
  listOwnedByAuthor,
  listRemotes,
  load,
  search
}

VideoSchema.pre('remove', function (next) {
  const video = this
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
      }
    )
  }

  parallel(tasks, next)
})

VideoSchema.pre('save', function (next) {
  const video = this
  const tasks = []

  if (video.isOwned()) {
    const videoPath = pathUtils.join(constants.CONFIG.STORAGE.UPLOAD_DIR, video.filename)
    this.podUrl = constants.CONFIG.WEBSERVER.URL

    tasks.push(
      // TODO: refractoring
      function (callback) {
        const options = {
          announceList: [
            [ constants.CONFIG.WEBSERVER.WS + '://' + constants.CONFIG.WEBSERVER.HOST + ':' + constants.CONFIG.WEBSERVER.PORT + '/tracker/socket' ]
          ],
          urlList: [
            constants.CONFIG.WEBSERVER.URL + constants.STATIC_PATHS.WEBSEED + video.filename
          ]
        }

        createTorrent(videoPath, options, function (err, torrent) {
          if (err) return callback(err)

          fs.writeFile(constants.CONFIG.STORAGE.TORRENTS_DIR + video.filename + '.torrent', torrent, function (err) {
            if (err) return callback(err)

            const parsedTorrent = parseTorrent(torrent)
            parsedTorrent.xs = video.podUrl + constants.STATIC_PATHS.TORRENTS + video.filename + '.torrent'
            video.magnetUri = magnet.encode(parsedTorrent)

            callback(null)
          })
        })
      },
      function (callback) {
        createThumbnail(videoPath, callback)
      }
    )

    parallel(tasks, function (err, results) {
      if (err) return next(err)

      video.thumbnail = results[1]

      return next()
    })
  } else {
    generateThumbnailFromBase64(video.thumbnail, function (err, thumbnailName) {
      if (err) return next(err)

      video.thumbnail = thumbnailName

      return next()
    })
  }
})

mongoose.model('Video', VideoSchema)

// ------------------------------ METHODS ------------------------------

function isOwned () {
  return this.filename !== null
}

function toFormatedJSON () {
  const json = {
    id: this._id,
    name: this.name,
    description: this.description,
    podUrl: this.podUrl.replace(/^https?:\/\//, ''),
    isLocal: this.isOwned(),
    magnetUri: this.magnetUri,
    author: this.author,
    duration: this.duration,
    tags: this.tags,
    thumbnailPath: constants.STATIC_PATHS.THUMBNAILS + '/' + this.thumbnail,
    createdDate: this.createdDate
  }

  return json
}

function toRemoteJSON (callback) {
  const self = this

  // Convert thumbnail to base64
  fs.readFile(pathUtils.join(constants.CONFIG.STORAGE.THUMBNAILS_DIR, this.thumbnail), function (err, thumbnailData) {
    if (err) {
      logger.error('Cannot read the thumbnail of the video')
      return callback(err)
    }

    const remoteVideo = {
      name: self.name,
      description: self.description,
      magnetUri: self.magnetUri,
      filename: null,
      author: self.author,
      duration: self.duration,
      thumbnailBase64: new Buffer(thumbnailData).toString('base64'),
      tags: self.tags,
      createdDate: self.createdDate,
      podUrl: self.podUrl
    }

    return callback(null, remoteVideo)
  })
}

// ------------------------------ STATICS ------------------------------

function getDurationFromFile (videoPath, callback) {
  ffmpeg.ffprobe(videoPath, function (err, metadata) {
    if (err) return callback(err)

    return callback(null, Math.floor(metadata.format.duration))
  })
}

function listForApi (start, count, sort, callback) {
  const query = {}
  return modelUtils.listForApiWithCount.call(this, query, start, count, sort, callback)
}

function listByUrlAndMagnet (fromUrl, magnetUri, callback) {
  this.find({ podUrl: fromUrl, magnetUri: magnetUri }, callback)
}

function listByUrls (fromUrls, callback) {
  this.find({ podUrl: { $in: fromUrls } }, callback)
}

function listOwned (callback) {
  // If filename is not null this is *our* video
  this.find({ filename: { $ne: null } }, callback)
}

function listOwnedByAuthor (author, callback) {
  this.find({ filename: { $ne: null }, author: author }, callback)
}

function listRemotes (callback) {
  this.find({ filename: null }, callback)
}

function load (id, callback) {
  this.findById(id, callback)
}

function search (value, field, start, count, sort, callback) {
  const query = {}
  // Make an exact search with the magnet
  if (field === 'magnetUri' || field === 'tags') {
    query[field] = value
  } else {
    query[field] = new RegExp(value)
  }

  modelUtils.listForApiWithCount.call(this, query, start, count, sort, callback)
}

// ---------------------------------------------------------------------------

function removeThumbnail (video, callback) {
  fs.unlink(constants.CONFIG.STORAGE.THUMBNAILS_DIR + video.thumbnail, callback)
}

function removeFile (video, callback) {
  fs.unlink(constants.CONFIG.STORAGE.UPLOAD_DIR + video.filename, callback)
}

// Maybe the torrent is not seeded, but we catch the error to don't stop the removing process
function removeTorrent (video, callback) {
  fs.unlink(constants.CONFIG.STORAGE.TORRENTS_DIR + video.filename + '.torrent', callback)
}

function createThumbnail (videoPath, callback) {
  const filename = pathUtils.basename(videoPath) + '.jpg'
  ffmpeg(videoPath)
    .on('error', callback)
    .on('end', function () {
      callback(null, filename)
    })
    .thumbnail({
      count: 1,
      folder: constants.CONFIG.STORAGE.THUMBNAILS_DIR,
      size: constants.THUMBNAILS_SIZE,
      filename: filename
    })
}

function generateThumbnailFromBase64 (data, callback) {
  // Creating the thumbnail for this remote video
  utils.generateRandomString(16, function (err, randomString) {
    if (err) return callback(err)

    const thumbnailName = randomString + '.jpg'
    fs.writeFile(constants.CONFIG.STORAGE.THUMBNAILS_DIR + thumbnailName, data, { encoding: 'base64' }, function (err) {
      if (err) return callback(err)

      return callback(null, thumbnailName)
    })
  })
}
