import { LogFn } from 'pino'
import { logger } from '../../../shared/index.js'

export function getTranscodingLogger () {
  return {
    info: buildWinstonLogger(logger.info.bind(logger)),
    debug: buildWinstonLogger(logger.debug.bind(logger)),
    warn: buildWinstonLogger(logger.warn.bind(logger)),
    error: buildWinstonLogger(logger.error.bind(logger))
  }
}

function buildWinstonLogger (log: LogFn) {
  return (arg1: string, arg2?: object) => {
    if (arg2) return log(arg2, arg1)

    return log(arg1)
  }
}
