const mongoose = require('mongoose')

// ---------------------------------------------------------------------------

const UserSchema = mongoose.Schema({
  password: String,
  username: String
})

UserSchema.path('password').required(true)
UserSchema.path('username').required(true)

UserSchema.statics = {
  getByUsernameAndPassword: getByUsernameAndPassword,
  list: list
}

mongoose.model('User', UserSchema)

// ---------------------------------------------------------------------------

function list (callback) {
  return this.find(callback)
}

function getByUsernameAndPassword (username, password) {
  return this.findOne({ username: username, password: password })
}
