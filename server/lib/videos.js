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
  convertVideoToRemote: convertVideoToRemote,
  createRemoteVideos: createRemoteVideos,
  getVideoDuration: getVideoDuration,
  getVideoState: getVideoState,
  createVideoThumbnail: createVideoThumbnail,
  removeVideosDataFromDisk: removeVideosDataFromDisk,
  removeRemoteVideos: removeRemoteVideos,
  seed: seed,
  seedAllExisting: seedAllExisting
}

function convertVideoToRemote (video, callback) {
  fs.readFile(thumbnailsDir + video.thumbnail, function (err, thumbnailData) {
    if (err) {
      logger.error('Cannot read the thumbnail of the video')
      return callback(err)
    }

    const remoteVideo = {
      name: video.name,
      description: video.description,
      magnetUri: video.magnetUri,
      author: video.author,
      duration: video.duration,
      thumbnailBase64: new Buffer(thumbnailData).toString('base64'),
      tags: video.tags,
      createdDate: video.createdDate,
      podUrl: video.podUrl
    }

    return callback(null, remoteVideo)
  })
}

function createRemoteVideos (videos, callback) {
  // Create the remote videos from the new pod
  createRemoteVideoObjects(videos, function (err, remoteVideos) {
    if (err) return callback(err)

    Videos.addRemotes(remoteVideos, callback)
  })
}

function getVideoDuration (videoPath, callback) {
  ffmpeg.ffprobe(videoPath, function (err, metadata) {
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

function createVideoThumbnail (videoPath, callback) {
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

// Remove video datas from disk (video file, thumbnail...)
function removeVideosDataFromDisk (videos, callback) {
  async.each(videos, function (video, callbackEach) {
    fs.unlink(thumbnailsDir + video.thumbnail, function (err) {
      if (err) logger.error('Cannot remove the video thumbnail')

      if (getVideoState(video).owned === true) {
        fs.unlink(uploadDir + video.namePath, function (err) {
          if (err) {
            logger.error('Cannot remove this video file.')
            return callbackEach(err)
          }

          callbackEach(null)
        })
      } else {
        callbackEach(null)
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
  Videos.listOwned(function (err, videosList) {
    if (err) {
      logger.error('Cannot get list of the videos to seed.')
      return callback(err)
    }

    async.each(videosList, function (video, callbackEach) {
      seed(uploadDir + video.namePath, function (err) {
        if (err) {
          logger.error('Cannot seed this video.')
          return callback(err)
        }

        callbackEach(null)
      })
    }, callback)
  })
}

// ---------------------------------------------------------------------------

module.exports = videos

// ---------------------------------------------------------------------------

function createRemoteVideoObjects (videos, callback) {
  const remoteVideos = []

  async.each(videos, function (video, callbackEach) {
    // Creating the thumbnail for this remote video
    utils.generateRandomString(16, function (err, randomString) {
      if (err) return callbackEach(err)

      const thumbnailName = randomString + '.jpg'
      createThumbnailFromBase64(thumbnailName, video.thumbnailBase64, function (err) {
        if (err) return callbackEach(err)

        const params = {
          name: video.name,
          description: video.description,
          magnetUri: video.magnetUri,
          podUrl: video.podUrl,
          duration: video.duration,
          thumbnail: thumbnailName,
          tags: video.tags,
          author: video.author
        }
        remoteVideos.push(params)

        callbackEach(null)
      })
    })
  },
  function (err) {
    if (err) return callback(err)

    callback(null, remoteVideos)
  })
}

function createThumbnailFromBase64 (thumbnailName, data, callback) {
  fs.writeFile(thumbnailsDir + thumbnailName, data, { encoding: 'base64' }, callback)
}
