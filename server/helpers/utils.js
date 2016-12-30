'use strict'

const crypto = require('crypto')

const logger = require('./logger')

const utils = {
  badRequest,
  cleanForExit,
  generateRandomString,
  isTestInstance
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

// ---------------------------------------------------------------------------

module.exports = utils
