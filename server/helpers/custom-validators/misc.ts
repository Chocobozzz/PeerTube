import * as validator from 'validator'

function exists (value: any) {
  return value !== undefined && value !== null
}

function isArray (value: any) {
  return Array.isArray(value)
}

function isDateValid (value: string) {
  return exists(value) && validator.isISO8601(value)
}

function isIdValid (value: string) {
  return exists(value) && validator.isInt('' + value)
}

function isUUIDValid (value: string) {
  return exists(value) && validator.isUUID('' + value, 4)
}

function isIdOrUUIDValid (value: string) {
  return isIdValid(value) || isUUIDValid(value)
}

function isBooleanValid (value: string) {
  return typeof value === 'boolean' || (typeof value === 'string' && validator.isBoolean(value))
}

// ---------------------------------------------------------------------------

export {
  exists,
  isArray,
  isIdValid,
  isUUIDValid,
  isIdOrUUIDValid,
  isDateValid,
  isBooleanValid
}
