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
import { inspect } from 'util'
import { format as sqlFormat } from 'sql-formatter'

program
  .option('-l, --level [level]', 'Level log (debug/info/warn/error)')
  .option('-f, --files [file...]', 'Files to parse. If not provided, the script will parse the latest log file from config)')
  .parse(process.argv)

const options = program.opts()

const excludedKeys = {
  level: true,
  message: true,
  splat: true,
  timestamp: true,
  label: true,
  sql: true
}
function keysExcluder (key, value) {
  return excludedKeys[key] === true ? undefined : value
}

const loggerFormat = winston.format.printf((info) => {
  let additionalInfos = JSON.stringify(info, keysExcluder, 2)
  if (additionalInfos === '{}') additionalInfos = ''
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

  return `[${info.label}] ${toTimeFormat(info.timestamp)} ${info.level}: ${info.message}${additionalInfos}`
})

const logger = winston.createLogger({
  transports: [
    new winston.transports.Console({
      level: options.level || 'debug',
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
  return new Promise<void>(async res => {
    const files = await getFiles()

    for (const file of files) {
      console.log('Opening %s.', file)

      const stream = createReadStream(file)

      const rl = createInterface({
        input: stream
      })

      rl.on('line', line => {
        try {
          const log = JSON.parse(line)
          // Don't know why but loggerFormat does not remove splat key
          Object.assign(log, { splat: undefined })

          logLevels[log.level](log)
        } catch (err) {
          console.error('Cannot parse line.', inspect(line))
          throw err
        }
      })

      stream.once('close', () => res())
    }
  })
}

// Thanks: https://stackoverflow.com/a/37014317
async function getNewestFile (files: string[], basePath: string) {
  const sorted = await mtimeSortFilesDesc(files, basePath)

  return (sorted.length > 0) ? sorted[0].file : ''
}

async function getFiles () {
  if (options.files) return options.files

  const logFiles = await readdir(CONFIG.STORAGE.LOG_DIR)

  const filename = await getNewestFile(logFiles, CONFIG.STORAGE.LOG_DIR)
  return [ join(CONFIG.STORAGE.LOG_DIR, filename) ]
}

function toTimeFormat (time: string) {
  const timestamp = Date.parse(time)

  if (isNaN(timestamp) === true) return 'Unknown date'

  return new Date(timestamp).toISOString()
}
