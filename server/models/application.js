const mongoose = require('mongoose')

// ---------------------------------------------------------------------------

const ApplicationSchema = mongoose.Schema({
  mongoSchemaVersion: {
    type: Number,
    default: 0
  }
})

ApplicationSchema.statics = {
  loadMongoSchemaVersion: loadMongoSchemaVersion,
  updateMongoSchemaVersion: updateMongoSchemaVersion
}

mongoose.model('Application', ApplicationSchema)

// ---------------------------------------------------------------------------

function loadMongoSchemaVersion (callback) {
  return this.findOne({}, { mongoSchemaVersion: 1 }, function (err, data) {
    const version = data ? data.mongoSchemaVersion : 0

    return callback(err, version)
  })
}

function updateMongoSchemaVersion (newVersion, callback) {
  return this.update({}, { mongoSchemaVersion: newVersion }, callback)
}
