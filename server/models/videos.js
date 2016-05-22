'use strict'

const async = require('async')
const config = require('config')
const mongoose = require('mongoose')

const logger = require('../helpers/logger')

const http = config.get('webserver.https') === true ? 'https' : 'http'
const host = config.get('webserver.host')
const port = config.get('webserver.port')

// ---------------------------------------------------------------------------

const videosSchema = mongoose.Schema({
  name: String,
  namePath: String,
  description: String,
  magnetUri: String,
  podUrl: String,
  author: String,
  duration: Number,
  thumbnail: String,
  createdDate: {
    type: Date,
    default: Date.now
  }
})
const VideosDB = mongoose.model('videos', videosSchema)

// ---------------------------------------------------------------------------

const Videos = {
  add: add,
  addRemotes: addRemotes,
  get: get,
  list: list,
  listFromUrl: listFromUrl,
  listFromUrls: listFromUrls,
  listFromUrlAndMagnets: listFromUrlAndMagnets,
  listFromRemotes: listFromRemotes,
  listOwned: listOwned,
  removeOwned: removeOwned,
  removeByIds: removeByIds,
  search: search
}

function add (video, callback) {
  logger.info('Adding %s video to database.', video.name)

  const params = video
  params.podUrl = http + '://' + host + ':' + port

  VideosDB.create(params, function (err, insertedVideo) {
    if (err) {
      logger.error('Cannot insert this video into database.')
      return callback(err)
    }

    callback(null, insertedVideo)
  })
}

function addRemotes (videos, callback) {
  videos.forEach(function (video) {
    // Ensure they are remote videos
    video.namePath = null
  })

  VideosDB.create(videos, callback)
}

function get (id, callback) {
  VideosDB.findById(id, function (err, video) {
    if (err) {
      logger.error('Cannot get this video.')
      return callback(err)
    }

    return callback(null, video)
  })
}

function list (start, count, sort, callback) {
  const query = {}
  return findWithCount(query, start, count, sort, callback)
}

function listFromUrl (fromUrl, callback) {
  VideosDB.find({ podUrl: fromUrl }, callback)
}

function listFromUrls (fromUrls, callback) {
  VideosDB.find({ podUrl: { $in: fromUrls } }, callback)
}

function listFromUrlAndMagnets (fromUrl, magnets, callback) {
  VideosDB.find({ podUrl: fromUrl, magnetUri: { $in: magnets } }, callback)
}

function listFromRemotes (callback) {
  VideosDB.find({ namePath: null }, callback)
}

function listOwned (callback) {
  // If namePath is not null this is *our* video
  VideosDB.find({ namePath: { $ne: null } }, function (err, videosList) {
    if (err) {
      logger.error('Cannot get the list of owned videos.')
      return callback(err)
    }

    return callback(null, videosList)
  })
}

// Return the video in the callback
function removeOwned (id, callback) {
  VideosDB.findByIdAndRemove(id, callback)
}

// Use the magnet Uri because the _id field is not the same on different servers
function removeByIds (ids, callback) {
  VideosDB.remove({ _id: { $in: ids } }, callback)
}

function search (value, field, start, count, sort, callback) {
  const query = {}
  // Make an exact search with the magnet
  if (field === 'magnetUri') {
    query[field] = value
  } else {
    query[field] = new RegExp(value)
  }

  findWithCount(query, start, count, sort, callback)
}

// ---------------------------------------------------------------------------

module.exports = Videos

// ---------------------------------------------------------------------------

function findWithCount (query, start, count, sort, callback) {
  async.parallel([
    function (asyncCallback) {
      VideosDB.find(query).skip(start).limit(start + count).sort(sort).exec(asyncCallback)
    },
    function (asyncCallback) {
      VideosDB.count(query, asyncCallback)
    }
  ], function (err, results) {
    if (err) return callback(err)

    const videos = results[0]
    const totalVideos = results[1]
    return callback(null, videos, totalVideos)
  })
}
