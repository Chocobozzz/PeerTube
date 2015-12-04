;(function () {
  'use strict'

  var async = require('async')
  var config = require('config')
  var dz = require('dezalgo')
  var fs = require('fs')
  var webtorrent = require('./webTorrentNode')

  var logger = require('./logger')
  var pods = require('./pods')
  var VideosDB = require('./database').VideosDB

  var videos = {}

  var http = config.get('webserver.https') === true ? 'https' : 'http'
  var host = config.get('webserver.host')
  var port = config.get('webserver.port')

  // ----------- Private functions -----------
  function seedVideo (path, callback) {
    logger.info('Seeding %s...', path)

    webtorrent.seed(path, function (torrent) {
      logger.info('%s seeded (%s).', path, torrent.magnetURI)

      return callback(null, torrent)
    })
  }

  // ----------- Public attributes ----------
  videos.uploadDir = __dirname + '/../' + config.get('storage.uploads')

  // ----------- Public functions -----------
  videos.list = function (callback) {
    VideosDB.find(function (err, videos_list) {
      if (err) {
        logger.error('Cannot get list of the videos.', { error: err })
        return callback(err)
      }

      return callback(null, videos_list)
    })
  }

  videos.add = function (data, callback) {
    var video_file = data.video
    var video_data = data.data

    logger.info('Adding %s video.', video_file.path)
    seedVideo(video_file.path, function (err, torrent) {
      if (err) {
        logger.error('Cannot seed this video.', { error: err })
        return callback(err)
      }

      var params = {
        name: video_data.name,
        namePath: video_file.filename,
        description: video_data.description,
        magnetUri: torrent.magnetURI,
        podUrl: http + '://' + host + ':' + port
      }

      VideosDB.create(params, function (err, video) {
        if (err) {
          logger.error('Cannot insert this video.', { error: err })
          return callback(err)
        }

        // Now we'll add the video's meta data to our friends
        params.namePath = null

        pods.addVideoToFriends(params)
        callback(null)
      })
    })
  }

  videos.remove = function (id, callback) {
    // Maybe the torrent is not seeded, but we catch the error to don't stop the removing process
    function removeTorrent (magnetUri, callback) {
      try {
        webtorrent.remove(magnetUri, callback)
      } catch (err) {
        logger.warn('Cannot remove the torrent from WebTorrent', { err: err })
        return callback(null)
      }
    }

    VideosDB.findById(id, function (err, video) {
      if (err || !video) {
        if (!err) err = new Error('Cannot find this video.')
        logger.error('Cannot find this video.', { error: err })
        return callback(err)
      }

      if (video.namePath === null) {
        var error_string = 'Cannot remove the video of another pod.'
        logger.error(error_string)
        return callback(new Error(error_string))
      }

      logger.info('Removing %s video', video.name)

      removeTorrent(video.magnetUri, function () {
        VideosDB.findByIdAndRemove(id, function (err) {
          if (err) {
            logger.error('Cannot remove the torrent.', { error: err })
            return callback(err)
          }

          fs.unlink(videos.uploadDir + video.namePath, function (err) {
            if (err) {
              logger.error('Cannot remove this video file.', { error: err })
              return callback(err)
            }

            var params = {
              name: video.name,
              magnetUri: video.magnetUri
            }

            pods.removeVideoToFriends(params)
            callback(null)
          })
        })
      })
    })
  }

  // Use the magnet Uri because the _id field is not the same on different servers
  videos.removeRemotes = function (fromUrl, magnetUris, callback) {
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

          callback(null)
        })
      })
    })
  }

  // { name, magnetUri, podUrl }
  videos.addRemotes = function (videos, callback) {
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
          logger.error('Cannot insert this remote video.', { error: err })
          return callback(err)
        }

        return callback(null, videos)
      })
    })
  }

  videos.get = function (id, callback) {
    VideosDB.findById(id, function (err, video) {
      if (err) {
        logger.error('Cannot get this video.', { error: err })
        return callback(err)
      }

      return callback(null, video)
    })
  }

  videos.search = function (name, callback) {
    VideosDB.find({ name: new RegExp(name) }, function (err, videos) {
      if (err) {
        logger.error('Cannot search the videos.', { error: err })
        return callback(err)
      }

      return callback(null, videos)
    })
  }

  videos.seedAll = function (callback) {
    VideosDB.find({ namePath: { $ne: null } }, function (err, videos_list) {
      if (err) {
        logger.error('Cannot get list of the videos to seed.', { error: err })
        return callback(err)
      }

      async.each(videos_list, function (video, each_callback) {
        seedVideo(videos.uploadDir + video.namePath, function (err) {
          if (err) {
            logger.error('Cannot seed this video.', { error: err })
            return callback(err)
          }

          each_callback(null)
        })
      }, callback)
    })
  }

  module.exports = videos
})()
