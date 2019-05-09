import { exists } from './misc'
import { LogLevel } from '../../../shared/models/server/log-level.type'

const logLevels: LogLevel[] = [ 'debug', 'info', 'warn', 'error' ]

function isValidLogLevel (value: any) {
  return exists(value) && logLevels.indexOf(value) !== -1
}

// ---------------------------------------------------------------------------

export {
  isValidLogLevel
}
