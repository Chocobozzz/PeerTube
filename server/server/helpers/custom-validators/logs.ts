import validator from 'validator'
import { CONSTRAINTS_FIELDS } from '@server/initializers/constants.js'
import { ClientLogLevel, ServerLogLevel } from '@peertube/peertube-models'
import { exists } from './misc.js'

const serverLogLevels = new Set<ServerLogLevel>([ 'debug', 'info', 'warn', 'error' ])
const clientLogLevels = new Set<ClientLogLevel>([ 'warn', 'error' ])

function isValidLogLevel (value: any) {
  return exists(value) && serverLogLevels.has(value)
}

function isValidClientLogMessage (value: any) {
  return typeof value === 'string' && validator.default.isLength(value, CONSTRAINTS_FIELDS.LOGS.CLIENT_MESSAGE)
}

function isValidClientLogLevel (value: any) {
  return exists(value) && clientLogLevels.has(value)
}

function isValidClientLogStackTrace (value: any) {
  return typeof value === 'string' && validator.default.isLength(value, CONSTRAINTS_FIELDS.LOGS.CLIENT_STACK_TRACE)
}

function isValidClientLogMeta (value: any) {
  return typeof value === 'string' && validator.default.isLength(value, CONSTRAINTS_FIELDS.LOGS.CLIENT_META)
}

function isValidClientLogUserAgent (value: any) {
  return typeof value === 'string' && validator.default.isLength(value, CONSTRAINTS_FIELDS.LOGS.CLIENT_USER_AGENT)
}

// ---------------------------------------------------------------------------

export {
  isValidLogLevel,
  isValidClientLogMessage,
  isValidClientLogStackTrace,
  isValidClientLogMeta,
  isValidClientLogLevel,
  isValidClientLogUserAgent
}
