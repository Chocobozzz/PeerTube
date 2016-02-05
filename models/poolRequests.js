;(function () {
  'use strict'

  var mongoose = require('mongoose')

  var logger = require('../helpers/logger')

  // ---------------------------------------------------------------------------

  var poolRequestsSchema = mongoose.Schema({
    type: String,
    id: String, // Special id to find duplicates (video created we want to remove...)
    request: mongoose.Schema.Types.Mixed
  })
  var PoolRequestsDB = mongoose.model('poolRequests', poolRequestsSchema)

  // ---------------------------------------------------------------------------

  var PoolRequests = {
    addRequest: addRequest,
    list: list,
    removeRequests: removeRequests
  }

  function addRequest (id, type, request) {
    logger.debug('Add request to the pool requests.', { id: id, type: type, request: request })

    PoolRequestsDB.findOne({ id: id }, function (err, entity) {
      if (err) {
        logger.error('Cannot find one pool request.', { error: err })
        return // Abort
      }

      if (entity) {
        if (entity.type === type) {
          logger.error('Cannot insert two same requests.')
          return // Abort
        }

        // Remove the request of the other type
        PoolRequestsDB.remove({ id: id }, function (err) {
          if (err) {
            logger.error('Cannot remove a pool request.', { error: err })
            return // Abort
          }
        })
      } else {
        PoolRequestsDB.create({ id: id, type: type, request: request }, function (err) {
          logger.error('Cannot create a pool request.', { error: err })
          return // Abort
        })
      }
    })
  }

  function list (callback) {
    PoolRequestsDB.find({}, { _id: 1, type: 1, request: 1 }, callback)
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
})()
