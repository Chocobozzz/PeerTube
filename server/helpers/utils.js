'use strict'

const logger = require('./logger')

const utils = {
  cleanForExit: cleanForExit
}

function cleanForExit (webtorrent_process) {
  logger.info('Gracefully exiting.')
  process.kill(-webtorrent_process.pid)
}

// ---------------------------------------------------------------------------

module.exports = utils
