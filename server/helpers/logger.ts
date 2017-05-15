// Thanks http://tostring.it/2014/06/23/advanced-logging-with-nodejs/
import mkdirp = require('mkdirp')
import path = require('path')
import winston = require('winston')

// Do not use barrel (dependencies issues)
import { CONFIG } from '../initializers/constants'

const label = CONFIG.WEBSERVER.HOSTNAME + ':' + CONFIG.WEBSERVER.PORT

// Create the directory if it does not exist
mkdirp.sync(CONFIG.STORAGE.LOG_DIR)

const logger = new winston.Logger({
  transports: [
    new winston.transports.File({
      level: 'debug',
      filename: path.join(CONFIG.STORAGE.LOG_DIR, 'all-logs.log'),
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

// TODO: useful?
// logger.stream = {
//   write: function (message) {
//     logger.info(message)
//   }
// }

// ---------------------------------------------------------------------------

export { logger }
