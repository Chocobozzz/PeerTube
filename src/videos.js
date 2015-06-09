;(function () {
  'use strict'

  var fs = require('fs')
  var webtorrent = require('./webTorrentNode')
  var config = require('config')
  var async = require('async')

  var logger = require('./logger')
  var VideosDB = require('./database').VideosDB
  var pods = require('./pods')

  var videos = {}
  // Public url
  var http = config.get('webserver.https') === true ? 'https' : 'http'
  var host = config.get('webserver.host')
  var port = config.get('webserver.port')

  // ----------- Private functions -----------
  function seedVideo (path, callback) {
    logger.debug('Seeding : %s', path)

    webtorrent.seed(path, function (torrent) {
      logger.debug('Seeded : %s', torrent.magnetURI)

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

    logger.debug('Path: %s', video_file.path)
    seedVideo(video_file.path, function (err, torrent) {
      if (err) {
        logger.error('Cannot seed this video.', { error: err })
        return callback(err)
      }

      var params = {
        name: video_data.name,
        namePath: video_file.name,
        description: video_data.description,
        magnetUri: torrent.magnetURI,
        podUrl: http + '://' + host + ':' + port
      }

      VideosDB.create(params, function (err, video) {
        if (err) {
          logger.error('Cannot insert this video.', { error: err })
          return callback(err)
        }

        // Now we'll send the video's meta data
        params.namePath = null

        logger.debug('Sending this video Uri to friends...')

        var data = {
          path: '/api/remotevideos/add',
          method: 'POST',
          data: params
        }

        pods.makeSecureRequest(data, function (err) {
          if (err) {
            logger.error('Somes issues when sending this video to friends.', { error: err })
            return callback(err)
          }

          return callback(null)
        })
      })
    })
  }

  videos.remove = function (id, callback) {
    // Maybe the torrent is not seeding, it doesn't have importance
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
        logger.error('Cannot find this video.', { error: err })
        return callback(err)
      }

      if (video.namePath === null) {
        var error_string = 'Cannot remove the video of another pod.'
        logger.error(error_string)
        return callback(new Error(error_string))
      }

      logger.debug('Removing video %s', video.magnetUri)

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

            var data = {
              path: '/api/remotevideos/remove',
              method: 'POST',
              data: {
                magnetUri: video.magnetUri
              }
            }

            // Yes this is a POST request because we add some informations in the body (signature, encrypt etc)
            pods.makeSecureRequest(data, function (err) {
              if (err) {
                logger.error('Somes issues when sending we want to remove the video to friends.', { error: err })
                return callback(err)
              }

              callback(null)
            })
          })
        })
      })
    })
  }

  // Use the magnet Uri because the _id field is not the same on different servers
  videos.removeRemote = function (fromUrl, magnetUri, callback) {
    // TODO : check if the remote server has the rights to remove this video

    VideosDB.findOne({ magnetUri: magnetUri }, function (err, video) {
      if (err || !video) {
        logger.error('Cannot find the torrent URI of this remote video.')
        return callback(err)
      }

      if (video.podUrl !== fromUrl) {
        logger.error('The pod has not rights on this video.')
        return callback(err)
      }

      VideosDB.findByIdAndRemove(video._id, function (err) {
        if (err) {
          logger.error('Cannot remove the remote video.')
          return callback(err)
        }

        callback(null)
      })
    })
  }

  // { name, magnetUri, podUrl }
  videos.addRemote = function (data, callback) {
    logger.debug('Add remote video from pod: %s', data.podUrl)

    var params = {
      name: data.name,
      namePath: null,
      description: data.description,
      magnetUri: data.magnetUri,
      podUrl: data.podUrl
    }

    VideosDB.create(params, function (err, video) {
      if (err) {
        logger.error('Cannot insert this remote video.', { error: err })
        return callback(err)
      }

      return callback(null, video)
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

  videos.seedAll = function (final_callback) {
    VideosDB.find({ namePath: { $ne: null } }, function (err, videos_list) {
      if (err) {
        logger.error('Cannot get list of the videos to seed.', { error: err })
        return final_callback(err)
      }

      async.each(videos_list, function (video, callback) {
        seedVideo(videos.uploadDir + video.namePath, function (err) {
          if (err) {
            logger.error('Cannot seed this video.', { error: err })
            return callback(err)
          }

          callback(null)
        })
      }, final_callback)
    })
  }

  module.exports = videos
})()
