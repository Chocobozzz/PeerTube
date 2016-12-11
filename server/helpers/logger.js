// Thanks http://tostring.it/2014/06/23/advanced-logging-with-nodejs/
'use strict'

const mkdirp = require('mkdirp')
const path = require('path')
const winston = require('winston')
winston.emitErrs = true

const constants = require('../initializers/constants')

const label = constants.CONFIG.WEBSERVER.HOSTNAME + ':' + constants.CONFIG.WEBSERVER.PORT

// Create the directory if it does not exist
mkdirp.sync(constants.CONFIG.STORAGE.LOG_DIR)

const logger = new winston.Logger({
  transports: [
    new winston.transports.File({
      level: 'debug',
      filename: path.join(constants.CONFIG.STORAGE.LOG_DIR, 'all-logs.log'),
      handleExceptions: true,
      json: true,
      maxsize: 5242880,
      maxFiles: 5,
      colorize: false,
      prettyPrint: true
    }),
    new winston.transports.Console({
      level: 'debug',
      label: label,
      handleExceptions: true,
      humanReadableUnhandledException: true,
      json: false,
      colorize: true,
      prettyPrint: true
    })
  ],
  exitOnError: true
})

logger.stream = {
  write: function (message, encoding) {
    logger.info(message)
  }
}

// ---------------------------------------------------------------------------

module.exports = logger
