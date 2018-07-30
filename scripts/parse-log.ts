import * as program from 'commander'
import { createReadStream, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { createInterface } from 'readline'
import * as winston from 'winston'
import { labelFormatter } from '../server/helpers/logger'
import { CONFIG } from '../server/initializers/constants'

program
  .option('-l, --level [level]', 'Level log (debug/info/warn/error)')
  .parse(process.argv)

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

  return `[${info.label}] ${toTimeFormat(info.timestamp)} ${info.level}: ${info.message}${additionalInfos}`
})

const logger = winston.createLogger({
  transports: [
    new winston.transports.Console({
      level: program['level'] || 'debug',
      stderrLevels: [],
      format: winston.format.combine(
        winston.format.splat(),
        labelFormatter,
        winston.format.colorize(),
        loggerFormat
      )
    })
  ],
  exitOnError: true
})

const logLevels = {
  error: logger.error.bind(logger),
  warn: logger.warn.bind(logger),
  info: logger.info.bind(logger),
  debug: logger.debug.bind(logger)
}

const logFiles = readdirSync(CONFIG.STORAGE.LOG_DIR)
const lastLogFile = getNewestFile(logFiles, CONFIG.STORAGE.LOG_DIR)

const path = join(CONFIG.STORAGE.LOG_DIR, lastLogFile)
console.log('Opening %s.', path)

const rl = createInterface({
  input: createReadStream(path)
})

rl.on('line', line => {
  const log = JSON.parse(line)
  // Don't know why but loggerFormat does not remove splat key
  Object.assign(log, { splat: undefined })

  logLevels[log.level](log)
})

function toTimeFormat (time: string) {
  const timestamp = Date.parse(time)

  if (isNaN(timestamp) === true) return 'Unknown date'

  return new Date(timestamp).toISOString()
}

// Thanks: https://stackoverflow.com/a/37014317
function getNewestFile (files: string[], basePath: string) {
  const out = []

  files.forEach(file => {
    const stats = statSync(basePath + '/' + file)
    if (stats.isFile()) out.push({ file, mtime: stats.mtime.getTime() })
  })

  out.sort((a, b) => b.mtime - a.mtime)

  return (out.length > 0) ? out[ 0 ].file : ''
}
