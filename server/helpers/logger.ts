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
  return excludedKeys[key] === true ? undefined : value
}

const consoleLoggerFormat = winston.format.printf(info => {
  let additionalInfos = JSON.stringify(info, keysExcluder, 2)
  if (additionalInfos === '{}') additionalInfos = ''
  else additionalInfos = ' ' + additionalInfos

  if (info.message && info.message.stack !== undefined) info.message = info.message.stack
  return `[${info.label}] ${info.timestamp} ${info.level}: ${info.message}${additionalInfos}`
})

const jsonLoggerFormat = winston.format.printf(info => {
  if (info.message && info.message.stack !== undefined) info.message = info.message.stack

  return JSON.stringify(info)
})

const timestampFormatter = winston.format.timestamp({
  format: 'YYYY-MM-dd HH:mm:ss.SSS'
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
        timestampFormatter,
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

// ---------------------------------------------------------------------------

export {
  timestampFormatter,
  labelFormatter,
  consoleLoggerFormat,
  logger
}
