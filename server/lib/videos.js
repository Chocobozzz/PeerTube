'use strict'

const async = require('async')
const config = require('config')
const pathUtils = require('path')
const webtorrent = require('../lib/webtorrent')

const logger = require('../helpers/logger')
const Videos = require('../models/videos')

const uploadDir = pathUtils.join(__dirname, '..', '..', config.get('storage.uploads'))

const videos = {
  getVideoState: getVideoState,
  seed: seed,
  seedAllExisting: seedAllExisting
}

function getVideoState (video) {
  const exist = (video !== null)
  let owned = false
  if (exist === true) {
    owned = (video.namePath !== null)
  }

  return { exist: exist, owned: owned }
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
