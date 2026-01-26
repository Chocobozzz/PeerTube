import { program } from 'commander'
import { createReadStream } from 'fs'
import { readdir } from 'fs/promises'
import { join } from 'path'
import { stdin } from 'process'
import { createInterface } from 'readline'
import { format as sqlFormat } from 'sql-formatter'
import { inspect } from 'util'
import * as winston from 'winston'
import { labelFormatter, mtimeSortFilesDesc } from '@server/helpers/logger.js'
import { CONFIG } from '@server/initializers/config.js'

program
  .option('-l, --level [level]', 'Level log (debug/info/warn/error)')
  .option('-f, --files [file...]', 'Files to parse. If not provided, the script will parse the latest log file from config)')
  .option('-t, --tags [tags...]', 'Display only lines with these tags')
  .option('-n, --not-tags [tags...]', 'Do not display lines containing these tags')
  .parse(process.argv)

const options = program.opts()

const excludedKeys = {
  level: true,
  message: true,
  splat: true,
  timestamp: true,
  tags: true,
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
      additionalInfos += '\n' + sqlFormat(info.sql as string, {
        language: 'sql',
        tabWidth: 2
      })
    } else {
      additionalInfos += ' - ' + info.sql
    }
  }

  return `[${info.label}] ${toTimeFormat(info.timestamp as string)} ${info.level}: ${info.message}${additionalInfos}`
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

async function run () {
  const files = await getFiles()

  for (const file of files) {
    if (file === 'peertube-audit.log') continue

    await readFile(file)
  }
}

function readFile (file: string) {
  console.log('Opening %s.', file)

  const stream = file === '-' ? stdin : createReadStream(file)

  const rl = createInterface({
    input: stream
  })

  return new Promise<void>(res => {
    rl.on('line', line => {
      try {
        const log = JSON.parse(line)
        if (options.tags && !containsTags(log.tags, options.tags)) {
          return
        }

        if (options.notTags && containsTags(log.tags, options.notTags)) {
          return
        }

        // Don't know why but loggerFormat does not remove splat key
        Object.assign(log, { splat: undefined })

        logLevels[log.level](log)
      } catch (err) {
        console.error('Cannot parse line.', inspect(line))
        throw err
      }
    })

    stream.once('end', () => res())
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

  const d = new Date(timestamp)
  return d.toLocaleString() + `.${d.getMilliseconds()}`
}

function containsTags (loggerTags: string[], optionsTags: string[]) {
  if (!loggerTags) return false

  for (const lt of loggerTags) {
    for (const ot of optionsTags) {
      if (lt === ot) return true
    }
  }

  return false
}
