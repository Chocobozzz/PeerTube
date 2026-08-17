import { context, trace } from '@opentelemetry/api'
import { arrayify } from '@peertube/peertube-core-utils'
import { isShortUUID, isTestOrDevInstance } from '@peertube/peertube-node-utils'
import { AsyncLocalStorage } from 'async_hooks'
import { stat } from 'fs/promises'
import { join } from 'path'
import { format as sqlFormat } from 'sql-formatter'
import { isatty } from 'tty'
import { createLogger as createWinstonLogger, format, transport, transports } from 'winston'
import { FileTransportOptions } from 'winston/lib/winston/transports/index.js'
import { isMainThread } from 'worker_threads'
import { CONFIG } from '../initializers/config.js'
import { LOG_FILENAME } from '../initializers/constants.js'
import { toCompleteUUID } from './custom-validators/misc.js'

const label = CONFIG.WEBSERVER.HOSTNAME + ':' + CONFIG.WEBSERVER.PORT

const tracingEnabled = CONFIG.OPEN_TELEMETRY.TRACING.ENABLED

// Symbols winston/logform use on the "info" object
const LEVEL = Symbol.for('level')
const SPLAT = Symbol.for('splat')

const consoleLoggerFormat = format.printf(info => {
  let additionalInfos = stringifyAdditionalInfo(info)

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

export function buildWinstonLogger (options: {
  labelSuffix?: string
} = {}) {
  const { labelSuffix } = options
  const loggerTransports: transport[] = []

  const formatters = [
    format.timestamp({
      format: localTimestamp
    })
  ]

  if (doesConsoleSupportColor()) formatters.push(format.colorize())

  formatters.push(consoleLoggerFormat)

  const consoleTransport = new transports.Console({
    handleExceptions: false,
    format: format.combine(...formatters)
  })

  // Don't add file logger transport in worker threads in production
  // See https://github.com/winstonjs/winston/issues/2393
  if (isMainThread || isTestOrDevInstance()) {
    const fileLoggerOptions: FileTransportOptions = {
      filename: join(CONFIG.STORAGE.LOG_DIR, LOG_FILENAME),
      handleExceptions: false,
      format: format.combine(
        format.timestamp({ format: isoTimestamp }),
        jsonLoggerFormat
      )
    }

    if (CONFIG.LOG.ROTATION.ENABLED) {
      fileLoggerOptions.maxsize = CONFIG.LOG.ROTATION.MAX_FILE_SIZE
      fileLoggerOptions.maxFiles = CONFIG.LOG.ROTATION.MAX_FILES
    }

    const fileTransport = new transports.File(fileLoggerOptions)

    loggerTransports.push(fileTransport)
  }

  loggerTransports.push(consoleTransport)

  return createWinstonLogger({
    level: process.env.LOGGER_LEVEL ?? CONFIG.LOG.LEVEL,
    // Only used by direct winston consumers; the PeerTube logger injects trace context itself
    defaultMeta: tracingEnabled
      ? {
        get traceId () {
          return trace.getSpanContext(context.active())?.traceId
        },
        get spanId () {
          return trace.getSpanContext(context.active())?.spanId
        },
        get traceFlags () {
          return trace.getSpanContext(context.active())?.traceFlags
        }
      }
      : undefined,
    format: format.combine(
      labelFormatter(labelSuffix),
      format.splat()
    ),
    transports: loggerTransports
  })
}

const rootWinstonLogger = buildWinstonLogger()

// ---------------------------------------------------------------------------
// Logger tags
// ---------------------------------------------------------------------------

export type LoggerTag = string | number

const tagsStore = new AsyncLocalStorage<LoggerTag[]>()

const noTags: LoggerTag[] = []

export function inLoggerContext<T> (tags: LoggerTag[], fn: () => T): T {
  // Always own the array: addLoggerContextTags() mutates the store in place
  const merged = appendTags(getLoggerContextTags(), tags)

  return tagsStore.run(merged === tags ? merged.slice() : merged, fn)
}

export function addLoggerContextTags (...tags: LoggerTag[]) {
  return tagsStore.getStore().push(...tags)
}

function getLoggerContextTags (): LoggerTag[] {
  return tagsStore.getStore() || noTags
}

function appendTags (existing: LoggerTag[], tags: LoggerTag[]): LoggerTag[] {
  let merged = existing

  for (const tag of tags) {
    if (merged.includes(tag)) continue

    // Copy the existing array on first tag
    if (merged === existing) merged = existing.slice()
    merged.push(tag)
  }

  return merged
}

// ---------------------------------------------------------------------------
// PeerTube logger: a winston wrapper that automatically injects tags
// ---------------------------------------------------------------------------

export type LoggerLevel = 'error' | 'warn' | 'info' | 'debug' | 'verbose'

export interface PeerTubeLogger {
  error(message: string, ...args: any[]): void
  warn(message: string, ...args: any[]): void
  info(message: string, ...args: any[]): void
  debug(message: string, ...args: any[]): void
  verbose(message: string, ...args: any[]): void

  isLevelEnabled(level: string): boolean

  // `level` is a string and not a LoggerLevel to stay compatible with winston `log()`, that also accepts custom levels
  log(level: string, ...args: any[]): void

  // Build a new logger that appends these tags to every call
  child(...tags: StaticLoggerTag[]): PeerTubeLogger

  // Run `fn` with this logger tags added to the async context
  inContext<T>(fn: () => T): T
  withContext<T>(tags: LoggerTag[], fn: () => T): T
}

const rootLogger: PeerTubeLogger = buildPeerTubeLogger(rootWinstonLogger, [])

// Registered here and not in buildWinstonLogger() so the handlers can't run before `rootLogger` is initialized
if (isMainThread) {
  process.on('uncaughtException', err => {
    rootLogger.error('Uncaught exception.', { err })
    exitOnCrash()
  })

  process.on('unhandledRejection', reason => {
    rootLogger.error('Unhandled rejection.', { reason })
    exitOnCrash()
  })
}

// Cache winston level enabled state, because `winstonLogger.isLevelEnabled()` is "expensive" and called on every log line
// Log level can't change at runtime
const enabledLevels = new Map<string, boolean>()

const isLevelEnabled = (level: string) => {
  let enabled = enabledLevels.get(level)
  if (enabled === undefined) {
    enabled = rootLogger.isLevelEnabled(level)
    enabledLevels.set(level, enabled)
  }

  return enabled
}

function buildPeerTubeLogger (winstonLogger: ReturnType<typeof buildWinstonLogger>, boundTags: LoggerTag[]): PeerTubeLogger {
  const write = (level: string, args: any[]) => {
    if (!isLevelEnabled(level)) return

    const meta = extractMeta(args)

    // Outermost scope first: async context, then tags bound to this logger, then the ones of this specific call.
    // Both the async context and `boundTags` are already deduplicated, so this is a linear merge over a handful of tags
    let tags = appendTags(getLoggerContextTags(), boundTags)
    if (meta.tags) tags = appendTags(tags, meta.tags)

    // Build the winston "info" object ourselves instead of going through `winstonLogger.log(level, message, ...splat)`:
    // that variadic entry point would re-merge the meta we just built and scan the message for `%s` tokens on every call
    const message = args[0]
    const info: any = { ...meta, [LEVEL]: level, level, message }

    if (meta.message) info.message = `${message} ${meta.message}`
    if (tags.length !== 0) info.tags = tags

    // Only set a splat when there are interpolation arguments, so `format.splat()` can bail out on the common case
    if (args.length > 1) info[SPLAT] = args.slice(1)

    if (tracingEnabled) addTraceContext(info)

    winstonLogger.write(info)
  }

  return {
    error: (...args: any[]) => write('error', args),
    warn: (...args: any[]) => write('warn', args),
    info: (...args: any[]) => write('info', args),
    debug: (...args: any[]) => write('debug', args),
    verbose: (...args: any[]) => write('verbose', args),

    log: (level: string, ...args: any[]) => write(level, args),

    child: (...tags: StaticLoggerTag[]) => buildPeerTubeLogger(winstonLogger, appendTags(boundTags, tags)),

    isLevelEnabled: (level: string) => winstonLogger.isLevelEnabled(level),

    inContext: <T>(fn: () => T) => inLoggerContext(boundTags, fn),
    withContext: <T>(tags: LoggerTag[], fn: () => T) => inLoggerContext(appendTags(boundTags, tags), fn)
  }
}

export function createLogger (...tags: StaticLoggerTag[]): PeerTubeLogger {
  return rootLogger.child(...tags)
}

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

function bunyanLogFactory (level: LoggerLevel) {
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

    rootLogger.log(level, ...args)
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

export type StaticLoggerTag =
  | 'actor'
  | 'ap-cleaner'
  | 'ap'
  | 'api'
  | 'automatic-tags'
  | 'avatar-image'
  | 'blacklist'
  | 'caption'
  | 'channel-synchronization'
  | 'chapter'
  | 'cleaner'
  | 'create'
  | 'debug-controller'
  | 'download'
  | 'embed-privacy'
  | 'ffmpeg'
  | 'geo-ip'
  | 'hls'
  | 'job-queue'
  | 'job'
  | 'lazy-load'
  | 'live'
  | 'move-file-system'
  | 'move-object-storage'
  | 'muxing'
  | 'notifier'
  | 'object-storage'
  | 'playlist'
  | 'plugin'
  | 'rate-limit'
  | 'redis'
  | 'redundancy'
  | 'refresh'
  | 'request'
  | 'resumable-upload'
  | 'runner'
  | 'schedulers'
  | 'share'
  | 'stats'
  | 'storyboard'
  | 'studio'
  | 'thumbnail'
  | 'transcoding'
  | 'transcription'
  | 'unzip'
  | 'update-videos'
  | 'update'
  | 'user-export'
  | 'user-import'
  | 'users'
  | 'video-download'
  | 'video-path-manager'
  | 'video-privacy'
  | 'video-state'
  | 'video'
  | 'view'
  | 'views'
  | 'vod'
  | 'youtube-dl'

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

function addTraceContext (info: any) {
  const spanContext = trace.getSpanContext(context.active())
  if (!spanContext) return

  info.traceId = spanContext.traceId
  info.spanId = spanContext.spanId
  info.traceFlags = spanContext.traceFlags
}

const notAdditionalInfoKeys = new Set([ 'label', 'timestamp', 'level', 'message', 'sql', 'tags' ])

// Most log lines have no additional info: only build the object (and run JSON.stringify) when there is something to print
function stringifyAdditionalInfo (info: any) {
  let additionalInfo: Record<string, any>

  for (const key in info) {
    if (info[key] === undefined) continue
    if (notAdditionalInfoKeys.has(key)) continue

    if (!additionalInfo) additionalInfo = {}
    additionalInfo[key] = info[key]
  }

  if (!additionalInfo) return ''

  return ' ' + JSON.stringify(additionalInfo, removeCyclicValues(), 2)
}

// Pop the winston "meta" object from the arguments, so we can inject our tags in it.
// Anything else (format string, splat arguments) is left untouched
function extractMeta (args: any[]): { tags?: LoggerTag[] } & Record<string, any> {
  const last = args[args.length - 1]

  if (
    typeof last !== 'object' ||
    last === null ||
    Array.isArray(last) ||
    last instanceof Error ||
    Object.getPrototypeOf(last) !== Object.prototype
  ) {
    return {}
  }

  return args.pop()
}

// ---------------------------------------------------------------------------
// `fecha` (used by winston when passing a format string) takes several µs per call, which dominates the cost of a log
// We only need one format, and under load many lines share the same millisecond, so build it by hand and cache it
// ---------------------------------------------------------------------------

let lastTimestampMs = -1
let lastTimestamp = ''
let lastIsoTimestampMs = -1
let lastIsoTimestamp = ''

function isoTimestamp () {
  const now = Date.now()
  if (now === lastIsoTimestampMs) return lastIsoTimestamp

  lastIsoTimestampMs = now
  lastIsoTimestamp = new Date(now).toISOString()

  return lastIsoTimestamp
}

function localTimestamp () {
  const now = Date.now()
  if (now === lastTimestampMs) return lastTimestamp

  const date = new Date(now)

  lastTimestampMs = now
  lastTimestamp = date.getFullYear() +
    '-' + pad2(date.getMonth() + 1) +
    '-' + pad2(date.getDate()) +
    ' ' + pad2(date.getHours()) +
    ':' + pad2(date.getMinutes()) +
    ':' + pad2(date.getSeconds()) +
    '.' + pad3(date.getMilliseconds())

  return lastTimestamp
}

function pad2 (value: number) {
  return value < 10
    ? '0' + value
    : '' + value
}

function pad3 (value: number) {
  if (value < 10) return '00' + value
  if (value < 100) return '0' + value

  return '' + value
}

// ---------------------------------------------------------------------------

function doesConsoleSupportColor () {
  if (isTestOrDevInstance()) return true

  return isatty(1) && process.env.TERM && process.env.TERM !== 'dumb'
}

function exitOnCrash () {
  rootWinstonLogger.on('finish', () => {
    process.exit(1)
  })

  rootWinstonLogger.end()
}

// ---------------------------------------------------------------------------

export function buildSearchTags (searchTagsArg: string[]): Set<string> | null {
  const searchTags = arrayify(searchTagsArg)
  if (!searchTags || searchTags.length === 0) return null

  const tagsOneOf = new Set(searchTags)

  for (const tag of searchTags) {
    if (isShortUUID(tag)) { // So we can also search for short UUIDs
      tagsOneOf.add(toCompleteUUID(tag))
    }
  }

  if (tagsOneOf.size === 0) return null

  return tagsOneOf
}
