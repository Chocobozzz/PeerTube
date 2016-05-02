'use strict'

const mongoose = require('mongoose')

const logger = require('../helpers/logger')

// ---------------------------------------------------------------------------

const requestsSchema = mongoose.Schema({
  type: String,
  id: String, // Special id to find duplicates (video created we want to remove...)
  request: mongoose.Schema.Types.Mixed
})
const RequestsDB = mongoose.model('requests', requestsSchema)

// ---------------------------------------------------------------------------

const Requests = {
  create: create,
  findById: findById,
  list: list,
  removeRequestById: removeRequestById,
  removeRequests: removeRequests
}

function create (id, type, request, callback) {
  RequestsDB.create({ id: id, type: type, request: request }, callback)
}

function findById (id, callback) {
  RequestsDB.findOne({ id: id }, callback)
}

function list (callback) {
  RequestsDB.find({}, { _id: 1, type: 1, request: 1 }, callback)
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

// ---------------------------------------------------------------------------

module.exports = Requests
