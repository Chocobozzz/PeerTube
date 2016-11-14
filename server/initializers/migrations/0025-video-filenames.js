/*
  Rename thumbnails and video filenames to _id.extension
*/

const each = require('async/each')
const fs = require('fs')
const path = require('path')
const mongoose = require('mongoose')

const constants = require('../constants')
const logger = require('../../helpers/logger')

const Video = mongoose.model('Video')

exports.up = function (callback) {
  // Use of lean because the new Video scheme does not have filename field
  Video.find({ filename: { $ne: null } }).lean().exec(function (err, videos) {
    if (err) throw err

    each(videos, function (video, callbackEach) {
      const torrentName = video.filename + '.torrent'
      const thumbnailName = video.thumbnail
      const thumbnailExtension = path.extname(thumbnailName)
      const videoName = video.filename
      const videoExtension = path.extname(videoName)

      const newTorrentName = video._id + '.torrent'
      const newThumbnailName = video._id + thumbnailExtension
      const newVideoName = video._id + videoExtension

      const torrentsDir = constants.CONFIG.STORAGE.TORRENTS_DIR
      const thumbnailsDir = constants.CONFIG.STORAGE.THUMBNAILS_DIR
      const videosDir = constants.CONFIG.STORAGE.VIDEOS_DIR

      logger.info('Renaming %s to %s.', torrentsDir + torrentName, torrentsDir + newTorrentName)
      fs.renameSync(torrentsDir + torrentName, torrentsDir + newTorrentName)

      logger.info('Renaming %s to %s.', thumbnailsDir + thumbnailName, thumbnailsDir + newThumbnailName)
      fs.renameSync(thumbnailsDir + thumbnailName, thumbnailsDir + newThumbnailName)

      logger.info('Renaming %s to %s.', videosDir + videoName, videosDir + newVideoName)
      fs.renameSync(videosDir + videoName, videosDir + newVideoName)

      Video.load(video._id, function (err, videoObj) {
        if (err) return callbackEach(err)

        videoObj.extname = videoExtension
        videoObj.remoteId = null
        videoObj.save(callbackEach)
      })
    }, callback)
  })
}

exports.down = function (callback) {
  throw new Error('Not implemented.')
}
