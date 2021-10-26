// Thanks http://tostring.it/2014/06/23/advanced-logging-with-nodejs/
import { stat } from 'fs-extra'
import { omit } from 'lodash'
import { join } from 'path'
import { format as sqlFormat } from 'sql-formatter'
import { createLogger, format, transports } from 'winston'
import { FileTransportOptions } from 'winston/lib/winston/transports'
import { CONFIG } from '../initializers/config'
import { LOG_FILENAME } from '../initializers/constants'

const label = CONFIG.WEBSERVER.HOSTNAME + ':' + CONFIG.WEBSERVER.PORT

function getLoggerReplacer () {
  const seen = new WeakSet()

  // Thanks: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Errors/Cyclic_object_value#Examples
  return (key: string, value: any) => {
    if (key === 'cert') return 'Replaced by the logger to avoid large log message'

    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) return

      seen.add(value)
    }

    if (value instanceof Set) {
      return Array.from(value)
    }

    if (value instanceof Map) {
      return Array.from(value.entries())
    }

    if (value instanceof Error) {
      const error = {}

      Object.getOwnPropertyNames(value).forEach(key => { error[key] = value[key] })

      return error
    }

    return value
  }
}

const consoleLoggerFormat = format.printf(info => {
  const toOmit = [ 'label', 'timestamp', 'level', 'message', 'sql', 'tags' ]

  const obj = omit(info, ...toOmit)

  let additionalInfos = JSON.stringify(obj, getLoggerReplacer(), 2)

  if (additionalInfos === undefined || additionalInfos === '{}') additionalInfos = ''
  else additionalInfos = ' ' + additionalInfos

  if (info.sql) {
    if (CONFIG.LOG.PRETTIFY_SQL) {
      additionalInfos += '\n' + sqlFormat(info.sql, {
        language: 'sql',
        indent: '  '
      })
    } else {
      additionalInfos += ' - ' + info.sql
    }
  }

  return `[${info.label}] ${info.timestamp} ${info.level}: ${info.message}${additionalInfos}`
})

const jsonLoggerFormat = format.printf(info => {
  return JSON.stringify(info, getLoggerReplacer())
})

const timestampFormatter = format.timestamp({
  format: 'YYYY-MM-DD HH:mm:ss.SSS'
})
const labelFormatter = (suffix?: string) => {
  return format.label({
    label: suffix ? `${label} ${suffix}` : label
  })
}

const fileLoggerOptions: FileTransportOptions = {
  filename: join(CONFIG.STORAGE.LOG_DIR, LOG_FILENAME),
  handleExceptions: true,
  format: format.combine(
    format.timestamp(),
    jsonLoggerFormat
  )
}

if (CONFIG.LOG.ROTATION.ENABLED) {
  fileLoggerOptions.maxsize = CONFIG.LOG.ROTATION.MAX_FILE_SIZE
  fileLoggerOptions.maxFiles = CONFIG.LOG.ROTATION.MAX_FILES
}

const logger = buildLogger()

function buildLogger (labelSuffix?: string) {
  return createLogger({
    level: CONFIG.LOG.LEVEL,
    format: format.combine(
      labelFormatter(labelSuffix),
      format.splat()
    ),
    transports: [
      new transports.File(fileLoggerOptions),
      new transports.Console({
        handleExceptions: true,
        format: format.combine(
          timestampFormatter,
          format.colorize(),
          consoleLoggerFormat
        )
      })
    ],
    exitOnError: true
  })
}

function bunyanLogFactory (level: string) {
  return function (...params: any[]) {
    let meta = null
    let args = [].concat(params)

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
  level: () => { },
  trace: bunyanLogFactory('debug'),
  debug: bunyanLogFactory('debug'),
  info: bunyanLogFactory('info'),
  warn: bunyanLogFactory('warn'),
  error: bunyanLogFactory('error'),
  fatal: bunyanLogFactory('error')
}

type LoggerTagsFn = (...tags: string[]) => { tags: string[] }
function loggerTagsFactory (...defaultTags: string[]): LoggerTagsFn {
  return (...tags: string[]) => {
    return { tags: defaultTags.concat(tags) }
  }
}

async function mtimeSortFilesDesc (files: string[], basePath: string) {
  const promises = []
  const out: { file: string, mtime: number }[] = []

  for (const file of files) {
    const p = stat(basePath + '/' + file)
      .then(stats => {
        if (stats.isFile()) out.push({ file, mtime: stats.mtime.getTime() })
      })

    promises.push(p)
  }

  await Promise.all(promises)

  out.sort((a, b) => b.mtime - a.mtime)

  return out
}

// ---------------------------------------------------------------------------

export {
  LoggerTagsFn,

  buildLogger,
  timestampFormatter,
  labelFormatter,
  consoleLoggerFormat,
  jsonLoggerFormat,
  mtimeSortFilesDesc,
  logger,
  loggerTagsFactory,
  bunyanLogger
}
