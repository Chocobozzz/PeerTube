// Thanks http://tostring.it/2014/06/23/advanced-logging-with-nodejs/
import { mkdirpSync } from 'fs-extra'
import { omit } from 'lodash'
import * as path from 'path'
import { format as sqlFormat } from 'sql-formatter'
import * as winston from 'winston'
import { FileTransportOptions } from 'winston/lib/winston/transports'
import { CONFIG } from '../initializers/config'
import { LOG_FILENAME } from '../initializers/constants'

const label = CONFIG.WEBSERVER.HOSTNAME + ':' + CONFIG.WEBSERVER.PORT

// Create the directory if it does not exist
// FIXME: use async
mkdirpSync(CONFIG.STORAGE.LOG_DIR)

function getLoggerReplacer () {
  const seen = new WeakSet()

  // Thanks: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Errors/Cyclic_object_value#Examples
  return (key: string, value: any) => {
    if (key === 'cert') return 'Replaced by the logger to avoid large log message'

    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) return

      seen.add(value)
    }

    if (value instanceof Error) {
      const error = {}

      Object.getOwnPropertyNames(value).forEach(key => { error[key] = value[key] })

      return error
    }

    return value
  }
}

const consoleLoggerFormat = winston.format.printf(info => {
  const toOmit = [ 'label', 'timestamp', 'level', 'message', 'sql' ]

  const obj = omit(info, ...toOmit)

  let additionalInfos = JSON.stringify(obj, getLoggerReplacer(), 2)

  if (additionalInfos === undefined || additionalInfos === '{}') additionalInfos = ''
  else additionalInfos = ' ' + additionalInfos

  if (info.sql) {
    if (CONFIG.LOG.PRETTIFY_SQL) {
      additionalInfos += '\n' + sqlFormat(info.sql, {
        language: 'sql',
        ident: '  '
      })
    } else {
      additionalInfos += ' - ' + info.sql
    }
  }

  return `[${info.label}] ${info.timestamp} ${info.level}: ${info.message}${additionalInfos}`
})

const jsonLoggerFormat = winston.format.printf(info => {
  return JSON.stringify(info, getLoggerReplacer())
})

const timestampFormatter = winston.format.timestamp({
  format: 'YYYY-MM-DD HH:mm:ss.SSS'
})
const labelFormatter = (suffix?: string) => {
  return winston.format.label({
    label: suffix ? `${label} ${suffix}` : label
  })
}

const fileLoggerOptions: FileTransportOptions = {
  filename: path.join(CONFIG.STORAGE.LOG_DIR, LOG_FILENAME),
  handleExceptions: true,
  format: winston.format.combine(
    winston.format.timestamp(),
    jsonLoggerFormat
  )
}

if (CONFIG.LOG.ROTATION.ENABLED) {
  fileLoggerOptions.maxsize = CONFIG.LOG.ROTATION.MAX_FILE_SIZE
  fileLoggerOptions.maxFiles = CONFIG.LOG.ROTATION.MAX_FILES
}

const logger = buildLogger()

function buildLogger (labelSuffix?: string) {
  return winston.createLogger({
    level: CONFIG.LOG.LEVEL,
    format: winston.format.combine(
      labelFormatter(labelSuffix),
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
}

function bunyanLogFactory (level: string) {
  return function () {
    let meta = null
    let args: any[] = []
    args.concat(arguments)

    if (arguments[0] instanceof Error) {
      meta = arguments[0].toString()
      args = Array.prototype.slice.call(arguments, 1)
      args.push(meta)
    } else if (typeof (args[0]) !== 'string') {
      meta = arguments[0]
      args = Array.prototype.slice.call(arguments, 1)
      args.push(meta)
    }

    logger[level].apply(logger, args)
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
  buildLogger,
  timestampFormatter,
  labelFormatter,
  consoleLoggerFormat,
  jsonLoggerFormat,
  logger,
  bunyanLogger
}
