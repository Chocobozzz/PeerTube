// Thanks http://tostring.it/2014/06/23/advanced-logging-with-nodejs/
import * as mkdirp from 'mkdirp'
import * as path from 'path'
import * as winston from 'winston'
import { CONFIG } from '../initializers'

const label = CONFIG.WEBSERVER.HOSTNAME + ':' + CONFIG.WEBSERVER.PORT

// Create the directory if it does not exist
mkdirp.sync(CONFIG.STORAGE.LOG_DIR)

function loggerReplacer (key: string, value: any) {
  if (value instanceof Error) {
    const error = {}

    Object.getOwnPropertyNames(value).forEach(key => error[ key ] = value[ key ])

    return error
  }

  return value
}

const consoleLoggerFormat = winston.format.printf(info => {
  let additionalInfos = JSON.stringify(info.meta || info.err, loggerReplacer, 2)
  if (additionalInfos === undefined || additionalInfos === '{}') additionalInfos = ''
  else additionalInfos = ' ' + additionalInfos

  return `[${info.label}] ${info.timestamp} ${info.level}: ${info.message}${additionalInfos}`
})

const jsonLoggerFormat = winston.format.printf(info => {
  return JSON.stringify(info, loggerReplacer)
})

const timestampFormatter = winston.format.timestamp({
  format: 'YYYY-MM-DD HH:mm:ss.SSS'
})
const labelFormatter = winston.format.label({
  label
})

const logger = winston.createLogger({
  level: CONFIG.LOG.LEVEL,
  format: winston.format.combine(
    labelFormatter,
    winston.format.splat()
  ),
  transports: [
    new winston.transports.File({
      filename: path.join(CONFIG.STORAGE.LOG_DIR, 'peertube.log'),
      handleExceptions: true,
      maxsize: 1024 * 1024 * 30,
      maxFiles: 5,
      format: winston.format.combine(
        winston.format.timestamp(),
        jsonLoggerFormat
      )
    }),
    new winston.transports.Console({
      handleExceptions: true,
      format: winston.format.combine(
        timestampFormatter,
        winston.format.colorize(),
        consoleLoggerFormat
      )
    })
  ],
  exitOnError: true
})

function bunyanLogFactory (level: string) {
  return function () {
    let meta = null
    let args: any[] = []
    args.concat(arguments)

    if (arguments[ 0 ] instanceof Error) {
      meta = arguments[ 0 ].toString()
      args = Array.prototype.slice.call(arguments, 1)
      args.push(meta)
    } else if (typeof (args[ 0 ]) !== 'string') {
      meta = arguments[ 0 ]
      args = Array.prototype.slice.call(arguments, 1)
      args.push(meta)
    }

    logger[ level ].apply(logger, args)
  }
}
const bunyanLogger = {
  trace: bunyanLogFactory('debug'),
  debug: bunyanLogFactory('debug'),
  info: bunyanLogFactory('info'),
  warn: bunyanLogFactory('warn'),
  error: bunyanLogFactory('error'),
  fatal: bunyanLogFactory('error')
}
// ---------------------------------------------------------------------------

export {
  timestampFormatter,
  labelFormatter,
  consoleLoggerFormat,
  jsonLoggerFormat,
  logger,
  bunyanLogger
}
