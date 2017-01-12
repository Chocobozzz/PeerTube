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
