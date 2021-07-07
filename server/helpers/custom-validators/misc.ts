import 'multer'
import { UploadFilesForCheck } from 'express'
import { sep } from 'path'
import validator from 'validator'
import { isShortUUID, shortToUUID } from '../uuid'

function exists (value: any) {
  return value !== undefined && value !== null
}

function isSafePath (p: string) {
  return exists(p) &&
    (p + '').split(sep).every(part => {
      return [ '..' ].includes(part) === false
    })
}

function isArray (value: any): value is any[] {
  return Array.isArray(value)
}

function isNotEmptyIntArray (value: any) {
  return Array.isArray(value) && value.every(v => validator.isInt('' + v)) && value.length !== 0
}

function isArrayOf (value: any, validator: (value: any) => boolean) {
  return isArray(value) && value.every(v => validator(v))
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

function isIntOrNull (value: any) {
  return value === null || validator.isInt('' + value)
}

// ---------------------------------------------------------------------------

function isFileFieldValid (
  files: { [ fieldname: string ]: Express.Multer.File[] } | Express.Multer.File[],
  field: string,
  optional = false
) {
  // Should have files
  if (!files) return optional
  if (isArray(files)) return optional

  // Should have a file
  const fileArray = files[field]
  if (!fileArray || fileArray.length === 0) {
    return optional
  }

  // The file should exist
  const file = fileArray[0]
  if (!file || !file.originalname) return false
  return file
}

function isFileMimeTypeValid (
  files: UploadFilesForCheck,
  mimeTypeRegex: string,
  field: string,
  optional = false
) {
  // Should have files
  if (!files) return optional
  if (isArray(files)) return optional

  // Should have a file
  const fileArray = files[field]
  if (!fileArray || fileArray.length === 0) {
    return optional
  }

  // The file should exist
  const file = fileArray[0]
  if (!file || !file.originalname) return false

  return new RegExp(`^${mimeTypeRegex}$`, 'i').test(file.mimetype)
}

function isFileValid (
  files: { [ fieldname: string ]: Express.Multer.File[] } | Express.Multer.File[],
  mimeTypeRegex: string,
  field: string,
  maxSize: number | null,
  optional = false
) {
  // Should have files
  if (!files) return optional
  if (isArray(files)) return optional

  // Should have a file
  const fileArray = files[field]
  if (!fileArray || fileArray.length === 0) {
    return optional
  }

  // The file should exist
  const file = fileArray[0]
  if (!file || !file.originalname) return false

  // Check size
  if ((maxSize !== null) && file.size > maxSize) return false

  return new RegExp(`^${mimeTypeRegex}$`, 'i').test(file.mimetype)
}

// ---------------------------------------------------------------------------

function toCompleteUUID (value: string) {
  if (isShortUUID(value)) return shortToUUID(value)

  return value
}

function toIntOrNull (value: string) {
  const v = toValueOrNull(value)

  if (v === null || v === undefined) return v
  if (typeof v === 'number') return v

  return validator.toInt('' + v)
}

function toBooleanOrNull (value: any) {
  const v = toValueOrNull(value)

  if (v === null || v === undefined) return v
  if (typeof v === 'boolean') return v

  return validator.toBoolean('' + v)
}

function toValueOrNull (value: string) {
  if (value === 'null') return null

  return value
}

function toArray (value: any) {
  if (value && isArray(value) === false) return [ value ]

  return value
}

function toIntArray (value: any) {
  if (!value) return []
  if (isArray(value) === false) return [ validator.toInt(value) ]

  return value.map(v => validator.toInt(v))
}

// ---------------------------------------------------------------------------

export {
  exists,
  isArrayOf,
  isNotEmptyIntArray,
  isArray,
  isIntOrNull,
  isIdValid,
  isSafePath,
  isUUIDValid,
  toCompleteUUID,
  isIdOrUUIDValid,
  isDateValid,
  toValueOrNull,
  toBooleanOrNull,
  isBooleanValid,
  toIntOrNull,
  toArray,
  toIntArray,
  isFileFieldValid,
  isFileMimeTypeValid,
  isFileValid
}
