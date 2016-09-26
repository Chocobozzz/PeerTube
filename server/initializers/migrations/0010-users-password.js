/*
  Convert plain user password to encrypted user password.
*/

const eachSeries = require('async/eachSeries')
const mongoose = require('mongoose')

const User = mongoose.model('User')

exports.up = function (callback) {
  User.list(function (err, users) {
    if (err) return callback(err)

    eachSeries(users, function (user, callbackEach) {
      user.save(callbackEach)
    }, callback)
  })
}

exports.down = function (callback) {
  throw new Error('Not implemented.')
}
