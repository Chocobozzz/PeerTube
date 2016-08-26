'use strict'

const mongoose = require('mongoose')
const map = require('lodash/map')
const validator = require('express-validator').validator

const constants = require('../initializers/constants')

// ---------------------------------------------------------------------------

const PodSchema = mongoose.Schema({
  url: String,
  publicKey: String,
  score: { type: Number, max: constants.FRIEND_SCORE.MAX },
  createdDate: {
    type: Date,
    default: Date.now
  }
})

// TODO: set options (TLD...)
PodSchema.path('url').validate(validator.isURL)
PodSchema.path('publicKey').required(true)
PodSchema.path('score').validate(function (value) { return !isNaN(value) })

PodSchema.methods = {
  toFormatedJSON: toFormatedJSON
}

PodSchema.statics = {
  countAll: countAll,
  incrementScores: incrementScores,
  list: list,
  listAllIds: listAllIds,
  listBadPods: listBadPods,
  load: load,
  loadByUrl: loadByUrl,
  removeAll: removeAll
}

PodSchema.pre('save', function (next) {
  const self = this

  Pod.loadByUrl(this.url, function (err, pod) {
    if (err) return next(err)

    if (pod) return next(new Error('Pod already exists.'))

    self.score = constants.FRIEND_SCORE.BASE
    return next()
  })
})

const Pod = mongoose.model('Pod', PodSchema)

// ------------------------------ METHODS ------------------------------

function toFormatedJSON () {
  const json = {
    id: this._id,
    url: this.url,
    score: this.score,
    createdDate: this.createdDate
  }

  return json
}

// ------------------------------ Statics ------------------------------

function countAll (callback) {
  return this.count(callback)
}

function incrementScores (ids, value, callback) {
  if (!callback) callback = function () {}
  return this.update({ _id: { $in: ids } }, { $inc: { score: value } }, { multi: true }, callback)
}

function list (callback) {
  return this.find(callback)
}

function listAllIds (callback) {
  return this.find({}, { _id: 1 }, function (err, pods) {
    if (err) return callback(err)

    return callback(null, map(pods, '_id'))
  })
}

function listBadPods (callback) {
  return this.find({ score: 0 }, callback)
}

function load (id, callback) {
  return this.findById(id, callback)
}

function loadByUrl (url, callback) {
  return this.findOne({ url: url }, callback)
}

function removeAll (callback) {
  return this.remove({}, callback)
}
