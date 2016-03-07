'use strict'

var async = require('async')
var config = require('config')
// TODO
var path = require('path')
var webtorrent = require('../lib/webtorrent')

var logger = require('../helpers/logger')
var Videos = require('../models/videos')

var uploadDir = path.join(__dirname, '..', config.get('storage.uploads'))

var videos = {
  seed: seed,
  seedAllExisting: seedAllExisting
}

function seed (path, callback) {
  logger.info('Seeding %s...', path)

  webtorrent.seed(path, function (torrent) {
    logger.info('%s seeded (%s).', path, torrent.magnetURI)

    return callback(null, torrent)
  })
}

function seedAllExisting (callback) {
  Videos.listOwned(function (err, videos_list) {
    if (err) {
      logger.error('Cannot get list of the videos to seed.')
      return callback(err)
    }

    async.each(videos_list, function (video, each_callback) {
      seed(uploadDir + video.namePath, function (err) {
        if (err) {
          logger.error('Cannot seed this video.')
          return callback(err)
        }

        each_callback(null)
      })
    }, callback)
  })
}

// ---------------------------------------------------------------------------

module.exports = videos
