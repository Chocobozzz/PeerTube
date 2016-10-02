/*
  Create the application collection in MongoDB.
  Used to store the actual MongoDB scheme version.
*/

const mongoose = require('mongoose')

const Application = mongoose.model('Application')

exports.up = function (callback) {
  const application = new Application()
  application.save(callback)
}

exports.down = function (callback) {
  throw new Error('Not implemented.')
}
