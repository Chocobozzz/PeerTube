/*
  Change video magnet structures
*/

const each = require('async/each')
const magnet = require('magnet-uri')
const mongoose = require('mongoose')

const Video = mongoose.model('Video')

exports.up = function (callback) {
  // Use of lean because the new Video scheme does not have magnetUri field
  Video.find({ }).lean().exec(function (err, videos) {
    if (err) throw err

    each(videos, function (video, callbackEach) {
      const parsed = magnet.decode(video.magnetUri)
      const infoHash = parsed.infoHash

      Video.load(video._id, function (err, videoObj) {
        if (err) return callbackEach(err)

        videoObj.magnet.infoHash = infoHash
        videoObj.save(callbackEach)
      })
    }, callback)
  })
}

exports.down = function (callback) {
  throw new Error('Not implemented.')
}
