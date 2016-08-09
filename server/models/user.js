const mongoose = require('mongoose')

const customUsersValidators = require('../helpers/custom-validators').users

// ---------------------------------------------------------------------------

const UserSchema = mongoose.Schema({
  password: String,
  username: String,
  role: String
})

UserSchema.path('password').required(customUsersValidators.isUserPasswordValid)
UserSchema.path('username').required(customUsersValidators.isUserUsernameValid)
UserSchema.path('role').validate(customUsersValidators.isUserRoleValid)

UserSchema.methods = {
  toFormatedJSON: toFormatedJSON
}

UserSchema.statics = {
  getByUsernameAndPassword: getByUsernameAndPassword,
  list: list,
  loadById: loadById,
  loadByUsername: loadByUsername
}

mongoose.model('User', UserSchema)

// ---------------------------------------------------------------------------

function getByUsernameAndPassword (username, password) {
  return this.findOne({ username: username, password: password })
}

function list (callback) {
  return this.find(callback)
}

function loadById (id, callback) {
  return this.findById(id, callback)
}

function loadByUsername (username, callback) {
  return this.findOne({ username: username }, callback)
}

function toFormatedJSON () {
  return {
    id: this._id,
    username: this.username,
    role: this.role
  }
}
