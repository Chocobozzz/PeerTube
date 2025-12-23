import { context, trace } from '@opentelemetry/api'
import { omit } from '@peertube/peertube-core-utils'
import { isTestOrDevInstance } from '@peertube/peertube-node-utils'
import { stat } from 'fs/promises'
import { join } from 'path'
import { format as sqlFormat } from 'sql-formatter'
import { isatty } from 'tty'
import { createLogger, format, transport, transports } from 'winston'
import { FileTransportOptions } from 'winston/lib/winston/transports/index.js'
import { isMainThread } from 'worker_threads'
import { CONFIG } from '../initializers/config.js'
import { LOG_FILENAME } from '../initializers/constants.js'

const label = CONFIG.WEBSERVER.HOSTNAME + ':' + CONFIG.WEBSERVER.PORT

const consoleLoggerFormat = format.printf(info => {
  let additionalInfos = JSON.stringify(getAdditionalInfo(info), removeCyclicValues(), 2)

  if (additionalInfos === undefined || additionalInfos === '{}') additionalInfos = ''
  else additionalInfos = ' ' + additionalInfos

  if (info.sql) {
    if (CONFIG.LOG.PRETTIFY_SQL) {
      additionalInfos += '\n' + sqlFormat(info.sql as string, {
        language: 'postgresql',
        tabWidth: 2
      })
    } else {
      additionalInfos += ' - ' + info.sql
    }
  }

  return `[${info.label}] ${info.timestamp} ${info.level}: ${info.message}${additionalInfos}`
})

export const jsonLoggerFormat: ReturnType<typeof format.printf> = format.printf(info => {
  return JSON.stringify(info, removeCyclicValues())
})

export const labelFormatter: (suffix?: string) => ReturnType<typeof format.printf> = (suffix?: string) => {
  return format.label({
    label: suffix ? `${label} ${suffix}` : label
  })
}

export function buildLogger (options: {
  labelSuffix?: string
  handleExceptions?: boolean // default false
}) {
  const { labelSuffix, handleExceptions = false } = options

  const formatters = [
    format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss.SSS'
    })
  ]

  if (doesConsoleSupportColor()) formatters.push(format.colorize())

  formatters.push(consoleLoggerFormat)

  const consoleTransport = new transports.Console({
    handleExceptions,
    format: format.combine(...formatters)
  })

  const fileLoggerOptions: FileTransportOptions = {
    filename: join(CONFIG.STORAGE.LOG_DIR, LOG_FILENAME),
    handleExceptions,
    format: format.combine(
      format.timestamp(),
      jsonLoggerFormat
    )
  }

  if (CONFIG.LOG.ROTATION.ENABLED) {
    fileLoggerOptions.maxsize = CONFIG.LOG.ROTATION.MAX_FILE_SIZE
    fileLoggerOptions.maxFiles = CONFIG.LOG.ROTATION.MAX_FILES
  }

  const loggerTransports: transport[] = []

  // Don't add file logger transport in worker threads in production
  // See https://github.com/winstonjs/winston/issues/2393
  if (isMainThread || isTestOrDevInstance()) {
    loggerTransports.push(new transports.File(fileLoggerOptions))
  }

  loggerTransports.push(consoleTransport)

  return createLogger({
    level: process.env.LOGGER_LEVEL ?? CONFIG.LOG.LEVEL,
    defaultMeta: {
      get traceId () {
        return trace.getSpanContext(context.active())?.traceId
      },
      get spanId () {
        return trace.getSpanContext(context.active())?.spanId
      },
      get traceFlags () {
        return trace.getSpanContext(context.active())?.traceFlags
      }
    },
    format: format.combine(
      labelFormatter(labelSuffix),
      format.splat()
    ),
    transports: loggerTransports,
    exitOnError: true
  })
}

export const logger = buildLogger({ handleExceptions: true })

// ---------------------------------------------------------------------------
// Bunyan logger adapter for Winston
// ---------------------------------------------------------------------------

export const bunyanLogger = {
  level: () => {},
  trace: bunyanLogFactory('debug'),
  debug: bunyanLogFactory('debug'),
  verbose: bunyanLogFactory('debug'),
  info: bunyanLogFactory('info'),
  warn: bunyanLogFactory('warn'),
  error: bunyanLogFactory('error'),
  fatal: bunyanLogFactory('error')
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

// ---------------------------------------------------------------------------
// Logger tags helpers
// ---------------------------------------------------------------------------

export type LoggerTags = { tags: (string | number)[] }
export type LoggerTagsFn = (...tags: (string | number)[]) => LoggerTags
export function loggerTagsFactory (...defaultTags: (string | number)[]): LoggerTagsFn {
  return (...tags: (string | number)[]) => {
    return { tags: defaultTags.concat(tags) }
  }
}

// ---------------------------------------------------------------------------

export async function mtimeSortFilesDesc (files: string[], basePath: string) {
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
// Private
// ---------------------------------------------------------------------------

function removeCyclicValues () {
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

      Object.getOwnPropertyNames(value).forEach(key => {
        error[key] = value[key]
      })

      return error
    }

    return value
  }
}

function getAdditionalInfo (info: any) {
  const toOmit = [ 'label', 'timestamp', 'level', 'message', 'sql', 'tags' ]

  return omit(info, toOmit)
}

function doesConsoleSupportColor () {
  if (isTestOrDevInstance()) return true

  return isatty(1) && process.env.TERM && process.env.TERM !== 'dumb'
}
