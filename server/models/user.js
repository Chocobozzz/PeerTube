const mongoose = require('mongoose')

const customUsersValidators = require('../helpers/custom-validators').users
const modelUtils = require('./utils')
const peertubeCrypto = require('../helpers/peertube-crypto')

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
  isPasswordMatch: isPasswordMatch,
  toFormatedJSON: toFormatedJSON
}

UserSchema.statics = {
  countTotal: countTotal,
  getByUsername: getByUsername,
  listForApi: listForApi,
  loadById: loadById,
  loadByUsername: loadByUsername
}

UserSchema.pre('save', function (next) {
  const user = this

  peertubeCrypto.cryptPassword(this.password, function (err, hash) {
    if (err) return next(err)

    user.password = hash

    return next()
  })
})

mongoose.model('User', UserSchema)

// ------------------------------ METHODS ------------------------------

function isPasswordMatch (password, callback) {
  return peertubeCrypto.comparePassword(password, this.password, callback)
}

function toFormatedJSON () {
  return {
    id: this._id,
    username: this.username,
    role: this.role,
    createdDate: this.createdDate
  }
}
// ------------------------------ STATICS ------------------------------

function countTotal (callback) {
  return this.count(callback)
}

function getByUsername (username) {
  return this.findOne({ username: username })
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
