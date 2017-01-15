'use strict'

const crypto = require('crypto')
const retry = require('async/retry')

const logger = require('./logger')

const utils = {
  badRequest,
  cleanForExit,
  generateRandomString,
  isTestInstance,
  getFormatedObjects,
  retryWrapper,
  transactionRetryer
}

function badRequest (req, res, next) {
  res.type('json').status(400).end()
}

function generateRandomString (size, callback) {
  crypto.pseudoRandomBytes(size, function (err, raw) {
    if (err) return callback(err)

    callback(null, raw.toString('hex'))
  })
}

function cleanForExit (webtorrentProcess) {
  logger.info('Gracefully exiting.')
  process.kill(-webtorrentProcess.pid)
}

function isTestInstance () {
  return (process.env.NODE_ENV === 'test')
}

function getFormatedObjects (objects, objectsTotal) {
  const formatedObjects = []

  objects.forEach(function (object) {
    formatedObjects.push(object.toFormatedJSON())
  })

  return {
    total: objectsTotal,
    data: formatedObjects
  }
}

// { arguments, errorMessage }
function retryWrapper (functionToRetry, options, finalCallback) {
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

// ---------------------------------------------------------------------------

module.exports = utils
