import 'multer'
import { UploadFilesForCheck } from 'express'
import { sep } from 'path'
import validator from 'validator'
import { isShortUUID, shortToUUID } from '@shared/extra-utils'

function exists (value: any) {
  return value !== undefined && value !== null
}

function isSafePath (p: string) {
  return exists(p) &&
    (p + '').split(sep).every(part => {
      return [ '..' ].includes(part) === false
    })
}

function isSafeFilename (filename: string, extension?: string) {
  const regex = extension
    ? new RegExp(`^[a-z0-9-]+\\.${extension}$`)
    : new RegExp(`^[a-z0-9-]+\\.[a-z0-9]{1,8}$`)

  return typeof filename === 'string' && !!filename.match(regex)
}

function isSafePeerTubeFilenameWithoutExtension (filename: string) {
  return filename.match(/^[a-z0-9-]+$/)
}

function isArray (value: any): value is any[] {
  return Array.isArray(value)
}

function isNotEmptyIntArray (value: any) {
  return Array.isArray(value) && value.every(v => validator.isInt('' + v)) && value.length !== 0
}

function isNotEmptyStringArray (value: any) {
  return Array.isArray(value) && value.every(v => typeof v === 'string' && v.length !== 0) && value.length !== 0
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

function areUUIDsValid (values: string[]) {
  return isArray(values) && values.every(v => isUUIDValid(v))
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

function isFileValid (options: {
  files: UploadFilesForCheck

  maxSize: number | null
  mimeTypeRegex: string | null

  field?: string

  optional?: boolean // Default false
}) {
  const { files, mimeTypeRegex, field, maxSize, optional = false } = options

  // Should have files
  if (!files) return optional

  const fileArray = isArray(files)
    ? files
    : files[field]

  if (!fileArray || !isArray(fileArray) || fileArray.length === 0) {
    return optional
  }

  // The file exists
  const file = fileArray[0]
  if (!file?.originalname) return false

  // Check size
  if ((maxSize !== null) && file.size > maxSize) return false

  if (mimeTypeRegex === null) return true

  return checkMimetypeRegex(file.mimetype, mimeTypeRegex)
}

function checkMimetypeRegex (fileMimeType: string, mimeTypeRegex: string) {
  return new RegExp(`^${mimeTypeRegex}$`, 'i').test(fileMimeType)
}

// ---------------------------------------------------------------------------

function toCompleteUUID (value: string) {
  if (isShortUUID(value)) {
    try {
      return shortToUUID(value)
    } catch {
      return null
    }
  }

  return value
}

function toCompleteUUIDs (values: string[]) {
  return values.map(v => toCompleteUUID(v))
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
  isNotEmptyStringArray,
  isUUIDValid,
  toCompleteUUIDs,
  toCompleteUUID,
  isIdOrUUIDValid,
  isDateValid,
  toValueOrNull,
  toBooleanOrNull,
  isBooleanValid,
  toIntOrNull,
  areUUIDsValid,
  toIntArray,
  isFileValid,
  isSafePeerTubeFilenameWithoutExtension,
  isSafeFilename,
  checkMimetypeRegex
}
