;(function () {
  // Thanks http://tostring.it/2014/06/23/advanced-logging-with-nodejs/

  'use strict'

  var winston = require('winston')
  var config = require('config')

  var logDir = __dirname + '/../' + config.get('storage.logs')

  winston.emitErrs = true

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

  module.exports = logger
  module.exports.stream = {
    write: function (message, encoding) {
      logger.info(message)
    }
  }
})()
