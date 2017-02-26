'use strict'

const crypto = require('crypto')

const logger = require('./logger')

const utils = {
  badRequest,
  createEmptyCallback,
  cleanForExit,
  generateRandomString,
  isTestInstance,
  getFormatedObjects
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

function createEmptyCallback () {
  return function (err) {
    if (err) logger.error('Error in empty callback.', { error: err })
  }
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

// ---------------------------------------------------------------------------

module.exports = utils
