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

function isBooleanValid (value: string) {
  return typeof value === 'boolean' || (typeof value === 'string' && validator.isBoolean(value))
}

function isFileValid (
  files: { [ fieldname: string ]: Express.Multer.File[] } | Express.Multer.File[],
  mimeTypeRegex: string,
  field: string,
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
  isBooleanValid,
  isFileValid
}
