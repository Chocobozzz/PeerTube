import validator from 'validator'
import { CONSTRAINTS_FIELDS } from '@server/initializers/constants.js'
import { AuditLogAction, AuditLogEntityType, ClientLogLevel, ServerLogLevel } from '@peertube/peertube-models'
import { exists } from './misc.js'

const serverLogLevels = new Set<ServerLogLevel>([ 'debug', 'info', 'warn', 'error' ])
const clientLogLevels = new Set<ClientLogLevel>([ 'warn', 'error' ])
const auditLogEntityTypes = new Set<string>(Object.values(AuditLogEntityType))
const auditLogActions = new Set<string>(Object.values(AuditLogAction))

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

function isValidAuditLogEntityType (value: any) {
  return exists(value) && auditLogEntityTypes.has(value)
}

function isValidAuditLogAction (value: any) {
  return exists(value) && auditLogActions.has(value)
}

// ---------------------------------------------------------------------------

export {
  isValidAuditLogAction,
  isValidAuditLogEntityType,
  isValidLogLevel,
  isValidClientLogMessage,
  isValidClientLogStackTrace,
  isValidClientLogMeta,
  isValidClientLogLevel,
  isValidClientLogUserAgent
}
