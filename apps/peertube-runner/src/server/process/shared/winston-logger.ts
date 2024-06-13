import { LogFn } from 'pino'
import { logger } from '../../../shared/index.js'

export function getWinstonLogger () {
  return {
    info: buildLogLevelFn(logger.info.bind(logger)),
    debug: buildLogLevelFn(logger.debug.bind(logger)),
    warn: buildLogLevelFn(logger.warn.bind(logger)),
    error: buildLogLevelFn(logger.error.bind(logger))
  }
}

function buildLogLevelFn (log: LogFn) {
  return (arg1: string, arg2?: object) => {
    if (arg2) return log(arg2, arg1)

    return log(arg1)
  }
}
