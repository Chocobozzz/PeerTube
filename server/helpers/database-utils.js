'use strict'

const retry = require('async/retry')

const db = require('../initializers/database')
const logger = require('./logger')

const utils = {
  commitTransaction,
  retryTransactionWrapper,
  rollbackTransaction,
  startSerializableTransaction,
  transactionRetryer
}

function commitTransaction (t, callback) {
  return t.commit().asCallback(callback)
}

function rollbackTransaction (err, t, callback) {
  // Try to rollback transaction
  if (t) {
    // Do not catch err, report the original one
    t.rollback().asCallback(function () {
      return callback(err)
    })
  } else {
    return callback(err)
  }
}

// { arguments, errorMessage }
function retryTransactionWrapper (functionToRetry, options, finalCallback) {
  const args = options.arguments ? options.arguments : []

  utils.transactionRetryer(
    function (callback) {
      return functionToRetry.apply(this, args.concat([ callback ]))
    },
    function (err) {
      if (err) {
        logger.error(options.errorMessage, { error: err })
      }

      // Do not return the error, continue the process
      return finalCallback(null)
    }
  )
}

function transactionRetryer (func, callback) {
  retry({
    times: 5,

    errorFilter: function (err) {
      const willRetry = (err.name === 'SequelizeDatabaseError')
      logger.debug('Maybe retrying the transaction function.', { willRetry })
      return willRetry
    }
  }, func, callback)
}

function startSerializableTransaction (callback) {
  console.log(db)
  db.sequelize.transaction({ isolationLevel: 'SERIALIZABLE' }).asCallback(function (err, t) {
    // We force to return only two parameters
    return callback(err, t)
  })
}

// ---------------------------------------------------------------------------

module.exports = utils
