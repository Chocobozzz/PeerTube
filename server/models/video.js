'use strict'

const config = require('config')
const eachLimit = require('async/eachLimit')
const ffmpeg = require('fluent-ffmpeg')
const fs = require('fs')
const parallel = require('async/parallel')
const pathUtils = require('path')
const mongoose = require('mongoose')

const constants = require('../initializers/constants')
const customValidators = require('../helpers/custom-validators')
const logger = require('../helpers/logger')
const utils = require('../helpers/utils')
const webtorrent = require('../lib/webtorrent')

const http = config.get('webserver.https') === true ? 'https' : 'http'
const host = config.get('webserver.host')
const port = config.get('webserver.port')
const uploadsDir = pathUtils.join(__dirname, '..', '..', config.get('storage.uploads'))
const thumbnailsDir = pathUtils.join(__dirname, '..', '..', config.get('storage.thumbnails'))

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

VideoSchema.path('name').validate(customValidators.isVideoNameValid)
VideoSchema.path('description').validate(customValidators.isVideoDescriptionValid)
VideoSchema.path('magnetUri').validate(customValidators.isVideoMagnetUriValid)
VideoSchema.path('podUrl').validate(customValidators.isVideoPodUrlValid)
VideoSchema.path('author').validate(customValidators.isVideoAuthorValid)
VideoSchema.path('duration').validate(customValidators.isVideoDurationValid)
// The tumbnail can be the path or the data in base 64
// The pre save hook will convert the base 64 data in a file on disk and replace the thumbnail key by the filename
VideoSchema.path('thumbnail').validate(function (value) {
  return customValidators.isVideoThumbnailValid(value) || customValidators.isVideoThumbnail64Valid(value)
})
VideoSchema.path('tags').validate(customValidators.isVideoTagsValid)

VideoSchema.methods = {
  isOwned: isOwned,
  toFormatedJSON: toFormatedJSON,
  toRemoteJSON: toRemoteJSON
}

VideoSchema.statics = {
  getDurationFromFile: getDurationFromFile,
  list: list,
  listByUrlAndMagnet: listByUrlAndMagnet,
  listByUrls: listByUrls,
  listOwned: listOwned,
  listRemotes: listRemotes,
  load: load,
  search: search,
  seedAllExisting: seedAllExisting
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
    const videoPath = pathUtils.join(uploadsDir, video.filename)
    this.podUrl = http + '://' + host + ':' + port

    tasks.push(
      function (callback) {
        seed(videoPath, callback)
      },
      function (callback) {
        createThumbnail(videoPath, callback)
      }
    )

    parallel(tasks, function (err, results) {
      if (err) return next(err)

      video.magnetUri = results[0].magnetURI
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
    thumbnailPath: constants.THUMBNAILS_STATIC_PATH + '/' + this.thumbnail,
    createdDate: this.createdDate
  }

  return json
}

function toRemoteJSON (callback) {
  const self = this

  // Convert thumbnail to base64
  fs.readFile(pathUtils.join(thumbnailsDir, this.thumbnail), function (err, thumbnailData) {
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

function list (start, count, sort, callback) {
  const query = {}
  return findWithCount.call(this, query, start, count, sort, callback)
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

  findWithCount.call(this, query, start, count, sort, callback)
}

function seedAllExisting (callback) {
  listOwned.call(this, function (err, videos) {
    if (err) return callback(err)

    eachLimit(videos, constants.SEEDS_IN_PARALLEL, function (video, callbackEach) {
      const videoPath = pathUtils.join(uploadsDir, video.filename)
      seed(videoPath, callbackEach)
    }, callback)
  })
}

// ---------------------------------------------------------------------------

function findWithCount (query, start, count, sort, callback) {
  const self = this

  parallel([
    function (asyncCallback) {
      self.find(query).skip(start).limit(count).sort(sort).exec(asyncCallback)
    },
    function (asyncCallback) {
      self.count(query, asyncCallback)
    }
  ], function (err, results) {
    if (err) return callback(err)

    const videos = results[0]
    const totalVideos = results[1]
    return callback(null, videos, totalVideos)
  })
}

function removeThumbnail (video, callback) {
  fs.unlink(thumbnailsDir + video.thumbnail, callback)
}

function removeFile (video, callback) {
  fs.unlink(uploadsDir + video.filename, callback)
}

// Maybe the torrent is not seeded, but we catch the error to don't stop the removing process
function removeTorrent (video, callback) {
  try {
    webtorrent.remove(video.magnetUri, callback)
  } catch (err) {
    logger.warn('Cannot remove the torrent from WebTorrent', { err: err })
    return callback(null)
  }
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
      folder: thumbnailsDir,
      size: constants.THUMBNAILS_SIZE,
      filename: filename
    })
}

function seed (path, callback) {
  logger.info('Seeding %s...', path)

  webtorrent.seed(path, function (torrent) {
    logger.info('%s seeded (%s).', path, torrent.magnetURI)

    return callback(null, torrent)
  })
}

function generateThumbnailFromBase64 (data, callback) {
  // Creating the thumbnail for this remote video
  utils.generateRandomString(16, function (err, randomString) {
    if (err) return callback(err)

    const thumbnailName = randomString + '.jpg'
    fs.writeFile(thumbnailsDir + thumbnailName, data, { encoding: 'base64' }, function (err) {
      if (err) return callback(err)

      return callback(null, thumbnailName)
    })
  })
}
