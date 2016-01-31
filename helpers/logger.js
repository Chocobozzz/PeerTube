;(function () {
  // Thanks http://tostring.it/2014/06/23/advanced-logging-with-nodejs/
  'use strict'

  var config = require('config')
  var winston = require('winston')
  winston.emitErrs = true

  var logDir = __dirname + '/../' + config.get('storage.logs')
  var logger = new winston.Logger({
    transports: [
      new winston.transports.File({
        level: 'debug',
        filename: logDir + '/all-logs.log',
        handleExceptions: true,
        json: true,
        maxsize: 5242880,
        maxFiles: 5,
        colorize: false
      }),
      new winston.transports.Console({
        level: 'debug',
        handleExceptions: true,
        humanReadableUnhandledException: true,
        json: false,
        colorize: true
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
})()
