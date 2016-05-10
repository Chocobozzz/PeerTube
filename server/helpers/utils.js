'use strict'

const crypto = require('crypto')

const logger = require('./logger')

const utils = {
  cleanForExit: cleanForExit,
  generateRandomString: generateRandomString
}

function generateRandomString (size, callback) {
  crypto.pseudoRandomBytes(size, function (err, raw) {
    if (err) return callback(err)

    callback(null, raw.toString('hex'))
  })
}

function cleanForExit (webtorrent_process) {
  logger.info('Gracefully exiting.')
  process.kill(-webtorrent_process.pid)
}

// ---------------------------------------------------------------------------

module.exports = utils
