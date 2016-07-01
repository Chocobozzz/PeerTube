const mongoose = require('mongoose')

// ---------------------------------------------------------------------------

const UserSchema = mongoose.Schema({
  password: String,
  username: String
})

UserSchema.path('password').required(true)
UserSchema.path('username').required(true)

UserSchema.statics = {
  list: list,
  loadByUsernameAndPassword: loadByUsernameAndPassword
}

mongoose.model('User', UserSchema)

// ---------------------------------------------------------------------------

function list (callback) {
  return this.find(callback)
}

function loadByUsernameAndPassword (username, password, callback) {
  return this.findOne({ username: username, password: password }, callback)
}
