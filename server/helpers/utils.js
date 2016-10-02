'use strict'

const crypto = require('crypto')

const logger = require('./logger')

const utils = {
  cleanForExit,
  generateRandomString
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

// ---------------------------------------------------------------------------

module.exports = utils
