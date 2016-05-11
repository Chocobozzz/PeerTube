'use strict'

const mongoose = require('mongoose')

const constants = require('../initializers/constants')
const logger = require('../helpers/logger')

// ---------------------------------------------------------------------------

const podsSchema = mongoose.Schema({
  url: String,
  publicKey: String,
  score: { type: Number, max: constants.FRIEND_BASE_SCORE }
})
const PodsDB = mongoose.model('pods', podsSchema)

// ---------------------------------------------------------------------------

const Pods = {
  add: add,
  count: count,
  findByUrl: findByUrl,
  findBadPods: findBadPods,
  incrementScores: incrementScores,
  list: list,
  remove: remove,
  removeAll: removeAll,
  removeAllByIds: removeAllByIds
}

// TODO: check if the pod is not already a friend
function add (data, callback) {
  if (!callback) callback = function () {}
  const params = {
    url: data.url,
    publicKey: data.publicKey,
    score: constants.FRIEND_BASE_SCORE
  }

  PodsDB.create(params, callback)
}

function count (callback) {
  return PodsDB.count(callback)
}

function findBadPods (callback) {
  PodsDB.find({ score: 0 }, callback)
}

function findByUrl (url, callback) {
  PodsDB.findOne({ url: url }, callback)
}

function incrementScores (ids, value, callback) {
  if (!callback) callback = function () {}
  PodsDB.update({ _id: { $in: ids } }, { $inc: { score: value } }, { multi: true }, callback)
}

function list (callback) {
  PodsDB.find(function (err, podsList) {
    if (err) {
      logger.error('Cannot get the list of the pods.')
      return callback(err)
    }

    return callback(null, podsList)
  })
}

function remove (url, callback) {
  if (!callback) callback = function () {}
  PodsDB.remove({ url: url }, callback)
}

function removeAll (callback) {
  if (!callback) callback = function () {}
  PodsDB.remove(callback)
}

function removeAllByIds (ids, callback) {
  if (!callback) callback = function () {}
  PodsDB.remove({ _id: { $in: ids } }, callback)
}

// ---------------------------------------------------------------------------

module.exports = Pods
