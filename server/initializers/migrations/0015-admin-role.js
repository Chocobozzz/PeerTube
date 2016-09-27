/*
  Set the admin role to the root user.
*/

const constants = require('../constants')
const mongoose = require('mongoose')

const User = mongoose.model('User')

exports.up = function (callback) {
  User.update({ username: 'root' }, { role: constants.USER_ROLES.ADMIN }, callback)
}

exports.down = function (callback) {
  throw new Error('Not implemented.')
}
