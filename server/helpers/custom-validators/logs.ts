import { exists } from './misc'
import { LogLevel } from '../../../shared/models/server/log-level.type'

const logLevels: LogLevel[] = [ 'debug', 'info', 'warn', 'error' ]

/**
 * @throws {Error}
 */
function checkLogLevel (value: any) {
  if (!exists(value)) throw new Error('Should have a log level')
  if (!logLevels.includes(value)) throw new Error('Should have a log level among ' + logLevels.join(', '))
}

// ---------------------------------------------------------------------------

export {
  checkLogLevel
}
