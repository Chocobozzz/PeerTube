const mongoose = require('mongoose')

const customUsersValidators = require('../helpers/custom-validators').users
const modelUtils = require('./utils')

// ---------------------------------------------------------------------------

const UserSchema = mongoose.Schema({
  createdDate: {
    type: Date,
    default: Date.now
  },
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
  countTotal: countTotal,
  getByUsernameAndPassword: getByUsernameAndPassword,
  listForApi: listForApi,
  loadById: loadById,
  loadByUsername: loadByUsername
}

mongoose.model('User', UserSchema)

// ---------------------------------------------------------------------------

function countTotal (callback) {
  return this.count(callback)
}

function getByUsernameAndPassword (username, password) {
  return this.findOne({ username: username, password: password })
}

function listForApi (start, count, sort, callback) {
  const query = {}
  return modelUtils.listForApiWithCount.call(this, query, start, count, sort, callback)
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
