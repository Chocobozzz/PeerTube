import { logger } from 'packages/peertube-runner/shared/logger'

export function getTranscodingLogger () {
  return {
    info: logger.info.bind(logger),
    debug: logger.debug.bind(logger),
    warn: logger.warn.bind(logger),
    error: logger.error.bind(logger)
  }
}
