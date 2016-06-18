'use strict'

const mongoose = require('mongoose')

const logger = require('../helpers/logger')

// ---------------------------------------------------------------------------

const requestsSchema = mongoose.Schema({
  request: mongoose.Schema.Types.Mixed,
  to: [ { type: mongoose.Schema.Types.ObjectId, ref: 'users' } ]
})
const RequestsDB = mongoose.model('requests', requestsSchema)

// ---------------------------------------------------------------------------

const Requests = {
  create: create,
  findById: findById,
  list: list,
  removeAll: removeAll,
  removePodOf: removePodOf,
  removeRequestById: removeRequestById,
  removeRequests: removeRequests,
  removeWithEmptyTo: removeWithEmptyTo
}

function create (request, to, callback) {
  RequestsDB.create({ request: request, to: to }, callback)
}

function findById (id, callback) {
  RequestsDB.findOne({ id: id }, callback)
}

function list (callback) {
  RequestsDB.find({}, { _id: 1, request: 1, to: 1 }, callback)
}

function removeAll (callback) {
  RequestsDB.remove({ }, callback)
}

function removePodOf (requestsIds, podId, callback) {
  if (!callback) callback = function () {}

  RequestsDB.update({ _id: { $in: requestsIds } }, { $pull: { to: podId } }, { multi: true }, callback)
}

function removeRequestById (id, callback) {
  RequestsDB.remove({ id: id }, callback)
}

function removeRequests (ids) {
  RequestsDB.remove({ _id: { $in: ids } }, function (err) {
    if (err) {
      logger.error('Cannot remove requests from the requests database.', { error: err })
      return // Abort
    }

    logger.info('Pool requests flushed.')
  })
}

function removeWithEmptyTo (callback) {
  if (!callback) callback = function () {}

  RequestsDB.remove({ to: { $size: 0 } }, callback)
}

// ---------------------------------------------------------------------------

module.exports = Requests
