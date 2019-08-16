// Thanks http://tostring.it/2014/06/23/advanced-logging-with-nodejs/
import { mkdirpSync } from 'fs-extra'
import * as path from 'path'
import * as winston from 'winston'
import { FileTransportOptions } from 'winston/lib/winston/transports'
import { CONFIG } from '../initializers/config'
import { omit } from 'lodash'

const label = CONFIG.WEBSERVER.HOSTNAME + ':' + CONFIG.WEBSERVER.PORT

// Create the directory if it does not exist
// FIXME: use async
mkdirpSync(CONFIG.STORAGE.LOG_DIR)

function loggerReplacer (key: string, value: any) {
  if (value instanceof Error) {
    const error = {}

    Object.getOwnPropertyNames(value).forEach(key => error[ key ] = value[ key ])

    return error
  }

  return value
}

const consoleLoggerFormat = winston.format.printf(info => {
  const obj = omit(info, 'label', 'timestamp', 'level', 'message')

  let additionalInfos = JSON.stringify(obj, loggerReplacer, 2)

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

const fileLoggerOptions: FileTransportOptions = {

  filename: path.join(CONFIG.STORAGE.LOG_DIR, 'peertube.log'),
  handleExceptions: true,
  format: winston.format.combine(
    winston.format.timestamp(),
    jsonLoggerFormat
  )
}

if (CONFIG.LOG.ROTATION) {
  fileLoggerOptions.maxsize = 1024 * 1024 * 12
  fileLoggerOptions.maxFiles = 20
}

const logger = winston.createLogger({
  level: CONFIG.LOG.LEVEL,
  format: winston.format.combine(
    labelFormatter,
    winston.format.splat()
  ),
  transports: [
    new winston.transports.File(fileLoggerOptions),
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
