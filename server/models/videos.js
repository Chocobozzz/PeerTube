'use strict'

var async = require('async')
var config = require('config')
var dz = require('dezalgo')
var fs = require('fs')
var mongoose = require('mongoose')
var path = require('path')

var logger = require('../helpers/logger')

var http = config.get('webserver.https') === true ? 'https' : 'http'
var host = config.get('webserver.host')
var port = config.get('webserver.port')
var uploadDir = path.join(__dirname, '..', '..', config.get('storage.uploads'))

// ---------------------------------------------------------------------------

var videosSchema = mongoose.Schema({
  name: String,
  namePath: String,
  description: String,
  magnetUri: String,
  podUrl: String
})
var VideosDB = mongoose.model('videos', videosSchema)

// ---------------------------------------------------------------------------

var Videos = {
  add: add,
  addRemotes: addRemotes,
  get: get,
  list: list,
  listOwned: listOwned,
  removeOwned: removeOwned,
  removeAllRemotes: removeAllRemotes,
  removeAllRemotesOf: removeAllRemotesOf,
  removeRemotesOfByMagnetUris: removeRemotesOfByMagnetUris,
  search: search
}

function add (video, callback) {
  logger.info('Adding %s video to database.', video.name)

  var params = video
  params.podUrl = http + '://' + host + ':' + port

  VideosDB.create(params, function (err, video) {
    if (err) {
      logger.error('Cannot insert this video into database.')
      return callback(err)
    }

    callback(null)
  })
}

// TODO: avoid doublons
function addRemotes (videos, callback) {
  if (!callback) callback = function () {}

  var to_add = []

  async.each(videos, function (video, callback_each) {
    callback_each = dz(callback_each)
    logger.debug('Add remote video from pod: %s', video.podUrl)

    var params = {
      name: video.name,
      namePath: null,
      description: video.description,
      magnetUri: video.magnetUri,
      podUrl: video.podUrl
    }

    to_add.push(params)

    callback_each()
  }, function () {
    VideosDB.create(to_add, function (err, videos) {
      if (err) {
        logger.error('Cannot insert this remote video.')
        return callback(err)
      }

      return callback(null, videos)
    })
  })
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

function list (callback) {
  VideosDB.find(function (err, videos_list) {
    if (err) {
      logger.error('Cannot get the list of the videos.')
      return callback(err)
    }

    return callback(null, videos_list)
  })
}

function listOwned (callback) {
  // If namePath is not null this is *our* video
  VideosDB.find({ namePath: { $ne: null } }, function (err, videos_list) {
    if (err) {
      logger.error('Cannot get the list of owned videos.')
      return callback(err)
    }

    return callback(null, videos_list)
  })
}

function removeOwned (id, callback) {
  VideosDB.findByIdAndRemove(id, function (err, video) {
    if (err) {
      logger.error('Cannot remove the torrent.')
      return callback(err)
    }

    fs.unlink(uploadDir + video.namePath, function (err) {
      if (err) {
        logger.error('Cannot remove this video file.')
        return callback(err)
      }

      callback(null)
    })
  })
}

function removeAllRemotes (callback) {
  VideosDB.remove({ namePath: null }, callback)
}

function removeAllRemotesOf (fromUrl, callback) {
  VideosDB.remove({ podUrl: fromUrl }, callback)
}

// Use the magnet Uri because the _id field is not the same on different servers
function removeRemotesOfByMagnetUris (fromUrl, magnetUris, callback) {
  if (callback === undefined) callback = function () {}

  VideosDB.find({ magnetUri: { $in: magnetUris } }, function (err, videos) {
    if (err || !videos) {
      logger.error('Cannot find the torrent URI of these remote videos.')
      return callback(err)
    }

    var to_remove = []
    async.each(videos, function (video, callback_async) {
      callback_async = dz(callback_async)

      if (video.podUrl !== fromUrl) {
        logger.error('The pod %s has not the rights on the video of %s.', fromUrl, video.podUrl)
      } else {
        to_remove.push(video._id)
      }

      callback_async()
    }, function () {
      VideosDB.remove({ _id: { $in: to_remove } }, function (err) {
        if (err) {
          logger.error('Cannot remove the remote videos.')
          return callback(err)
        }

        logger.info('Removed remote videos from %s.', fromUrl)
        callback(null)
      })
    })
  })
}

function search (name, callback) {
  VideosDB.find({ name: new RegExp(name) }, function (err, videos) {
    if (err) {
      logger.error('Cannot search the videos.')
      return callback(err)
    }

    return callback(null, videos)
  })
}

// ---------------------------------------------------------------------------

module.exports = Videos
