'use strict'

var logger = require('./logger')

var utils = {
  cleanForExit: cleanForExit
}

function cleanForExit (webtorrent_process) {
  logger.info('Gracefully exiting.')
  process.kill(-webtorrent_process.pid)
}

// ---------------------------------------------------------------------------

module.exports = utils
