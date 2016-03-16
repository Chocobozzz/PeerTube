'use strict'

const mongoose = require('mongoose')

const logger = require('../helpers/logger')

// ---------------------------------------------------------------------------

const poolRequestsSchema = mongoose.Schema({
  type: String,
  id: String, // Special id to find duplicates (video created we want to remove...)
  request: mongoose.Schema.Types.Mixed
})
const PoolRequestsDB = mongoose.model('poolRequests', poolRequestsSchema)

// ---------------------------------------------------------------------------

const PoolRequests = {
  create: create,
  findById: findById,
  list: list,
  removeRequestById: removeRequestById,
  removeRequests: removeRequests
}

function create (id, type, request, callback) {
  PoolRequestsDB.create({ id: id, type: type, request: request }, callback)
}

function findById (id, callback) {
  PoolRequestsDB.findOne({ id: id }, callback)
}

function list (callback) {
  PoolRequestsDB.find({}, { _id: 1, type: 1, request: 1 }, callback)
}

function removeRequestById (id, callback) {
  PoolRequestsDB.remove({ id: id }, callback)
}

function removeRequests (ids) {
  PoolRequestsDB.remove({ _id: { $in: ids } }, function (err) {
    if (err) {
      logger.error('Cannot remove requests from the pool requests database.', { error: err })
      return // Abort
    }

    logger.info('Pool requests flushed.')
  })
}

// ---------------------------------------------------------------------------

module.exports = PoolRequests
