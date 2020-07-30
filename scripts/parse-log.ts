import { registerTSPaths } from '../server/helpers/register-ts-paths'
registerTSPaths()

import * as program from 'commander'
import { createReadStream, readdir } from 'fs-extra'
import { join } from 'path'
import { createInterface } from 'readline'
import * as winston from 'winston'
import { labelFormatter } from '../server/helpers/logger'
import { CONFIG } from '../server/initializers/config'
import { mtimeSortFilesDesc } from '../shared/core-utils/logs/logs'

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
        labelFormatter(),
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

run()
  .then(() => process.exit(0))
  .catch(err => console.error(err))

function run () {
  return new Promise(async res => {
    const logFiles = await readdir(CONFIG.STORAGE.LOG_DIR)
    const lastLogFile = await getNewestFile(logFiles, CONFIG.STORAGE.LOG_DIR)

    const path = join(CONFIG.STORAGE.LOG_DIR, lastLogFile)
    console.log('Opening %s.', path)

    const stream = createReadStream(path)

    const rl = createInterface({
      input: stream
    })

    rl.on('line', line => {
      const log = JSON.parse(line)
      // Don't know why but loggerFormat does not remove splat key
      Object.assign(log, { splat: undefined })

      logLevels[log.level](log)
    })

    stream.once('close', () => res())
  })
}

// Thanks: https://stackoverflow.com/a/37014317
async function getNewestFile (files: string[], basePath: string) {
  const sorted = await mtimeSortFilesDesc(files, basePath)

  return (sorted.length > 0) ? sorted[0].file : ''
}

function toTimeFormat (time: string) {
  const timestamp = Date.parse(time)

  if (isNaN(timestamp) === true) return 'Unknown date'

  return new Date(timestamp).toISOString()
}
