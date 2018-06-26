import 'multer'
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

function isBooleanValid (value: any) {
  return typeof value === 'boolean' || (typeof value === 'string' && validator.isBoolean(value))
}

function toIntOrNull (value: string) {
  if (value === 'null') return null

  return validator.toInt(value)
}

function toValueOrNull (value: string) {
  if (value === 'null') return null

  return value
}

function isFileValid (
  files: { [ fieldname: string ]: Express.Multer.File[] } | Express.Multer.File[],
  mimeTypeRegex: string,
  field: string,
  maxSize: number,
  optional = false
) {
  // Should have files
  if (!files) return optional
  if (isArray(files)) return optional

  // Should have a file
  const fileArray = files[ field ]
  if (!fileArray || fileArray.length === 0) {
    return optional
  }

  // The file should exist
  const file = fileArray[ 0 ]
  if (!file || !file.originalname) return false

  // Check size
  if (maxSize && file.size > maxSize) return false

  return new RegExp(`^${mimeTypeRegex}$`, 'i').test(file.mimetype)
}

// ---------------------------------------------------------------------------

export {
  exists,
  isArray,
  isIdValid,
  isUUIDValid,
  isIdOrUUIDValid,
  isDateValid,
  toValueOrNull,
  isBooleanValid,
  toIntOrNull,
  isFileValid
}
