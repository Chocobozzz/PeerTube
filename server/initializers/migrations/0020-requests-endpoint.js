/*
  Set the endpoint videos for requests.
*/

const mongoose = require('mongoose')

const Request = mongoose.model('Request')

exports.up = function (callback) {
  Request.update({ }, { endpoint: 'videos' }, callback)
}

exports.down = function (callback) {
  throw new Error('Not implemented.')
}
