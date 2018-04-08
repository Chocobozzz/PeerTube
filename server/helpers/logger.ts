// Thanks http://tostring.it/2014/06/23/advanced-logging-with-nodejs/
import * as mkdirp from 'mkdirp'
import * as path from 'path'
import * as winston from 'winston'
import { CONFIG } from '../initializers'

const label = CONFIG.WEBSERVER.HOSTNAME + ':' + CONFIG.WEBSERVER.PORT

// Create the directory if it does not exist
mkdirp.sync(CONFIG.STORAGE.LOG_DIR)

// Use object for better performances (~ O(1))
const excludedKeys = {
  level: true,
  message: true,
  splat: true,
  timestamp: true,
  label: true
}
function keysExcluder (key, value) {
  if (excludedKeys[key] === true) return undefined

  if (key === 'err') return value.stack

  return value
}

const consoleLoggerFormat = winston.format.printf(info => {
  let additionalInfos = JSON.stringify(info, keysExcluder, 2)
  if (additionalInfos === '{}') additionalInfos = ''
  else additionalInfos = ' ' + additionalInfos

  if (info.message && info.message.stack !== undefined) info.message = info.message.stack
  return `[${info.label}] ${info.timestamp} ${info.level}: ${info.message}${additionalInfos}`
})

const jsonLoggerFormat = winston.format.printf(infoArg => {
  let info = infoArg.err
    ? Object.assign({}, infoArg, { err: infoArg.err.stack })
    : infoArg

  if (infoArg.message && infoArg.message.stack !== undefined) {
    info = Object.assign({}, info, { message: infoArg.message.stack })
  }

  return JSON.stringify(info)
})

const timestampFormatter = winston.format.timestamp({
  format: 'YYYY-MM-DD HH:mm:ss.SSS'
})
const labelFormatter = winston.format.label({
  label
})

const logger = new winston.createLogger({
  level: CONFIG.LOG.LEVEL,
  transports: [
    new winston.transports.File({
      filename: path.join(CONFIG.STORAGE.LOG_DIR, 'peertube.log'),
      handleExceptions: true,
      maxsize: 5242880,
      maxFiles: 5,
      format: winston.format.combine(
        winston.format.timestamp(),
        labelFormatter,
        winston.format.splat(),
        jsonLoggerFormat
      )
    }),
    new winston.transports.Console({
      handleExceptions: true,
      humanReadableUnhandledException: true,
      format: winston.format.combine(
        timestampFormatter,
        winston.format.splat(),
        labelFormatter,
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
    let args = [].concat(arguments)

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
  logger,
  bunyanLogger
}
