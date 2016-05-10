'use strict'

const async = require('async')
const config = require('config')
const ffmpeg = require('fluent-ffmpeg')
const fs = require('fs')
const map = require('lodash/map')
const pathUtils = require('path')

const constants = require('../initializers/constants')
const logger = require('../helpers/logger')
const utils = require('../helpers/utils')
const Videos = require('../models/videos')
const webtorrent = require('../lib/webtorrent')

const uploadDir = pathUtils.join(__dirname, '..', '..', config.get('storage.uploads'))
const thumbnailsDir = pathUtils.join(__dirname, '..', '..', config.get('storage.thumbnails'))

const videos = {
  createRemoteVideos: createRemoteVideos,
  getVideoDuration: getVideoDuration,
  getVideoState: getVideoState,
  getVideoThumbnail: getVideoThumbnail,
  removeVideosDataFromDisk: removeVideosDataFromDisk,
  removeRemoteVideos: removeRemoteVideos,
  seed: seed,
  seedAllExisting: seedAllExisting
}

function createRemoteVideos (videos, callback) {
  // Create the remote videos from the new pod
  createRemoteVideoObjects(videos, function (err, remote_videos) {
    if (err) return callback(err)

    Videos.addRemotes(remote_videos, callback)
  })
}

function getVideoDuration (video_path, callback) {
  ffmpeg.ffprobe(video_path, function (err, metadata) {
    if (err) return callback(err)

    return callback(null, Math.floor(metadata.format.duration))
  })
}

function getVideoState (video) {
  const exist = (video !== null)
  let owned = false
  if (exist === true) {
    owned = (video.namePath !== null)
  }

  return { exist: exist, owned: owned }
}

function getVideoThumbnail (video_path, callback) {
  const filename = pathUtils.basename(video_path) + '.jpg'
  ffmpeg(video_path)
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

// Remove video datas from disk (video file, thumbnail...)
function removeVideosDataFromDisk (videos, callback) {
  async.each(videos, function (video, callback_each) {
    fs.unlink(thumbnailsDir + video.thumbnail, function (err) {
      if (err) logger.error('Cannot remove the video thumbnail')

      if (getVideoState(video).owned === true) {
        fs.unlink(uploadDir + video.namePath, function (err) {
          if (err) {
            logger.error('Cannot remove this video file.')
            return callback_each(err)
          }

          callback_each(null)
        })
      } else {
        callback_each(null)
      }
    })
  }, callback)
}

function removeRemoteVideos (videos, callback) {
  Videos.removeByIds(map(videos, '_id'), function (err) {
    if (err) return callback(err)

    removeVideosDataFromDisk(videos, callback)
  })
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

// ---------------------------------------------------------------------------

function createRemoteVideoObjects (videos, callback) {
  const remote_videos = []

  async.each(videos, function (video, callback_each) {
    // Creating the thumbnail for this remote video
    utils.generateRandomString(16, function (err, random_string) {
      if (err) return callback_each(err)

      const thumbnail_name = random_string + '.jpg'
      createThumbnailFromBase64(thumbnail_name, video.thumbnail_base64, function (err) {
        if (err) return callback_each(err)

        const params = {
          name: video.name,
          description: video.description,
          magnetUri: video.magnetUri,
          podUrl: video.podUrl,
          duration: video.duration,
          thumbnail: thumbnail_name
        }
        remote_videos.push(params)

        callback_each(null)
      })
    })
  },
  function (err) {
    if (err) return callback(err)

    callback(null, remote_videos)
  })
}

function createThumbnailFromBase64 (thumbnail_name, data, callback) {
  fs.writeFile(thumbnailsDir + thumbnail_name, data, { encoding: 'base64' }, callback)
}
