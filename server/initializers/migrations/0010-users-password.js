/*
  Convert plain user password to encrypted user password.
*/

const mongoose = require('mongoose')

const User = mongoose.model('User')

exports.up = function (callback) {
  User.list(function (err, users) {
    if (err) return callback(err)

    users.forEach(function (user) {
      user.save()
    })

    return callback(null)
  })
}

exports.down = function (callback) {
  throw new Error('Not implemented.')
}
