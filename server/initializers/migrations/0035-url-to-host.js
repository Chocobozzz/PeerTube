/*
  Change video magnet structures
*/

const each = require('async/each')
const mongoose = require('mongoose')

const Video = mongoose.model('Video')

exports.up = function (callback) {
  // Use of lean because the new Video scheme does not have podUrl field
  Video.find({ }).lean().exec(function (err, videos) {
    if (err) throw err

    each(videos, function (video, callbackEach) {
      Video.load(video._id, function (err, videoObj) {
        if (err) return callbackEach(err)

        const host = video.podUrl.split('://')[1]

        videoObj.podHost = host
        videoObj.save(callbackEach)
      })
    }, callback)
  })
}

exports.down = function (callback) {
  throw new Error('Not implemented.')
}
