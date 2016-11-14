'use strict'

const each = require('async/each')
const mongoose = require('mongoose')
const map = require('lodash/map')
const validator = require('express-validator').validator

const constants = require('../initializers/constants')

const Video = mongoose.model('Video')

// ---------------------------------------------------------------------------

const PodSchema = mongoose.Schema({
  host: String,
  publicKey: String,
  score: { type: Number, max: constants.FRIEND_SCORE.MAX },
  createdDate: {
    type: Date,
    default: Date.now
  }
})

PodSchema.path('host').validate(validator.isURL)
PodSchema.path('publicKey').required(true)
PodSchema.path('score').validate(function (value) { return !isNaN(value) })

PodSchema.methods = {
  toFormatedJSON
}

PodSchema.statics = {
  countAll,
  incrementScores,
  list,
  listAllIds,
  listBadPods,
  load,
  loadByHost,
  removeAll
}

PodSchema.pre('save', function (next) {
  const self = this

  Pod.loadByHost(this.host, function (err, pod) {
    if (err) return next(err)

    if (pod) return next(new Error('Pod already exists.'))

    self.score = constants.FRIEND_SCORE.BASE
    return next()
  })
})

PodSchema.pre('remove', function (next) {
  // Remove the videos owned by this pod too
  Video.listByHost(this.host, function (err, videos) {
    if (err) return next(err)

    each(videos, function (video, callbackEach) {
      video.remove(callbackEach)
    }, next)
  })
})

const Pod = mongoose.model('Pod', PodSchema)

// ------------------------------ METHODS ------------------------------

function toFormatedJSON () {
  const json = {
    id: this._id,
    host: this.host,
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

function loadByHost (host, callback) {
  return this.findOne({ host }, callback)
}

function removeAll (callback) {
  return this.remove({}, callback)
}
