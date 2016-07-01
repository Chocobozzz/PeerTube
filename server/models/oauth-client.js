const mongoose = require('mongoose')

// ---------------------------------------------------------------------------

const OAuthClientSchema = mongoose.Schema({
  clientSecret: String,
  grants: Array,
  redirectUris: Array
})

OAuthClientSchema.path('clientSecret').required(true)

OAuthClientSchema.statics = {
  list: list,
  loadByIdAndSecret: loadByIdAndSecret,
  loadFirstClient: loadFirstClient
}

mongoose.model('OAuthClient', OAuthClientSchema)

// ---------------------------------------------------------------------------

function list (callback) {
  return this.find(callback)
}

function loadFirstClient (callback) {
  return this.findOne({}, callback)
}

function loadByIdAndSecret (id, clientSecret) {
  return this.findOne({ _id: id, clientSecret: clientSecret })
}
