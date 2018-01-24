import { createReadStream } from 'fs'
import { join } from 'path'
import { createInterface } from 'readline'
import * as winston from 'winston'
import { labelFormatter, loggerFormat, timestampFormatter } from '../server/helpers/logger'
import { CONFIG } from '../server/initializers/constants'

const logger = new winston.createLogger({
  transports: [
    new winston.transports.Console({
      level: 'debug',
      stderrLevels: [],
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

const logLevels = {
  error: logger.error.bind(logger),
  warn: logger.warn.bind(logger),
  info: logger.info.bind(logger),
  debug: logger.debug.bind(logger)
}

const path = join(CONFIG.STORAGE.LOG_DIR, 'peertube.log')
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
