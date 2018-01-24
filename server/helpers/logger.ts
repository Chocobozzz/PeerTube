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

const loggerFormat = winston.format.printf((info) => {
  let additionalInfos = JSON.stringify(info, keysExcluder, 2)
  if (additionalInfos === '{}') additionalInfos = ''
  else additionalInfos = ' ' + additionalInfos

  return `[${info.label}] ${info.timestamp} ${info.level}: ${info.message}${additionalInfos}`
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
        winston.format.json()
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
        loggerFormat
      )
    })
  ],
  exitOnError: true
})

// ---------------------------------------------------------------------------

export {
  timestampFormatter,
  labelFormatter,
  loggerFormat,
  logger
}
