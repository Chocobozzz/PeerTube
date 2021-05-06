import 'multer'
import { UploadFilesForCheck } from 'express'
import { sep } from 'path'
import validator from 'validator'

// ---------------------------------------------------------------------------
// UTILS

/**
 * Handle errors thrown by non-pure boolean validators as boolean
 *
 * @param fun Function that might throw an Error
 * @returns boolean matching no error = `true`, error = `false`
 */
function EtoB (fun: Function, asError?: false): (...args: any[]) => boolean
function EtoB (fun: Function, asError: true): (...args: any[]) => Error
function EtoB (fun: Function, asError = false): (...args: any[]) => boolean | Error {
  return (...args) => {
    try {
      fun(...args)
    } catch (error) {
      return asError ? error : false
    }
    return asError ? undefined : true
  }
}

// ---------------------------------------------------------------------------
// VALIDATORS

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

/**
 * @throws {Error}
 */
function isDateValid (value: string) {
  if (!exists(value)) throw new Error('Should have a date')
  if (!validator.isISO8601(value)) throw new Error('Should have a date conforming to ISO8601')
  return true
}

/**
 * @throws {Error}
 */
function isIdValid (value: string) {
  if (!exists(value)) throw new Error('Should have an id')
  if (!validator.isInt('' + value)) throw new Error('Should have an integer id')
  return true
}

/**
 * @throws {Error}
 */
function isUUIDValid (value: string) {
  if (!exists(value)) throw new Error('Should have a uuid')
  if (!validator.isUUID('' + value, 4)) throw new Error('Should have a v4 uuid')
  return true
}

/**
 * @throws {Error}
 */
function isIdOrUUIDValid (value: string) {
  const errors = [
    EtoB(isIdValid, true)(value)?.message,
    EtoB(isUUIDValid, true)(value)?.message
  ].filter(v => v)
  if (errors.length > 1) throw new Error(errors.join(' OR '))
  return true
}

function isBooleanValid (value: any) {
  return typeof value === 'boolean' || (typeof value === 'string' && validator.isBoolean(value))
}

function isIntOrNull (value: any) {
  return value === null || validator.isInt('' + value)
}

/**
 * @throws {Error}
 */
function isFileFieldValid (
  files: { [ fieldname: string ]: Express.Multer.File[] } | Express.Multer.File[],
  field: string,
  optional = false
) {
  const res = ((): [boolean, string?] => {
    // Should have files
    if (!files) return [ optional, 'Should have files' ]
    if (isArray(files)) return [ optional, 'Should have a single file' ]

    // Should have a file
    const fileArray = files[field]
    if (!fileArray || fileArray.length === 0) {
      return [ optional, 'File array should contain a file' ]
    }

    // The file should exist
    const file = fileArray[0]
    if (!file || !file.originalname) return [ false, 'Should have a file with valid attributes' ]
    return [ file ]
  })()

  if (res[0]) return true
  throw new Error(res[1])
}

/**
 * @throws {Error}
 */
function isFileMimeTypeValid (
  files: UploadFilesForCheck,
  mimeTypeRegex: string,
  field: string,
  optional = false
) {
  const res = ((): [boolean, string?] => {
    // Should have files
    if (!files) return [ optional, 'Should have files' ]
    if (isArray(files)) return [ optional, 'Should have a single file' ]

    // Should have a file
    const fileArray = files[field]
    if (!fileArray || fileArray.length === 0) {
      return [ optional, 'File array should contain a file' ]
    }

    // The file should exist
    const file = fileArray[0]
    if (!file || !file.originalname) return [ false, 'Should have a file with valid attributes' ]

    return [ new RegExp(`^${mimeTypeRegex}$`, 'i').test(file.mimetype), `Should have a file mimetype matching ^${mimeTypeRegex}$` ]
  })()

  if (res[0]) return true
  throw new Error(res[1])
}

/**
 * @throws {Error}
 */
function isFileValid (
  files: { [ fieldname: string ]: Express.Multer.File[] } | Express.Multer.File[],
  mimeTypeRegex: string,
  field: string,
  maxSize: number | null,
  optional = false
) {
  const res = ((): [boolean, string?] => {
    // Should have files
    if (!files) return [ optional, 'Should have files' ]
    if (isArray(files)) return [ optional, 'Should have a single file' ]

    // Should have a file
    const fileArray = files[field]
    if (!fileArray || fileArray.length === 0) {
      return [ optional, 'File array should contain a file' ]
    }

    // The file should exist
    const file = fileArray[0]
    if (!file || !file.originalname) return [ false, 'Should have a file with valid attributes' ]

    // Check size
    if ((maxSize !== null) && file.size > maxSize) return [ false, `Should have a file with a maximum size of ${maxSize} bytes` ]

    return [ new RegExp(`^${mimeTypeRegex}$`, 'i').test(file.mimetype), `Should have a file mimetype matching ^${mimeTypeRegex}$` ]
  })()

  if (res[0]) return true
  throw new Error(res[1])
}

// ---------------------------------------------------------------------------
// SANITIZERS

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
  EtoB,
  exists,
  isArrayOf,
  isNotEmptyIntArray,
  isArray,
  isIntOrNull,
  isIdValid,
  isSafePath,
  isUUIDValid,
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
