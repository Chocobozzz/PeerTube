import 'multer'
import { UploadFilesForCheck } from 'express'
import { sep } from 'path'
import validator from 'validator'
import { isShortUUID, shortToUUID } from '@peertube/peertube-node-utils'

export function exists (value: any) {
  return value !== undefined && value !== null
}

export function isSafePath (p: string) {
  return exists(p) &&
    (p + '').split(sep).every(part => {
      return [ '..' ].includes(part) === false
    })
}

export function isSafeFilename (filename: string, extension?: string) {
  const regex = extension
    ? new RegExp(`^[a-z0-9-]+\\.${extension}$`)
    : new RegExp(`^[a-z0-9-]+\\.[a-z0-9]{1,8}$`)

  return typeof filename === 'string' && !!filename.match(regex)
}

export function isSafePeerTubeFilenameWithoutExtension (filename: string) {
  return filename.match(/^[a-z0-9-]+$/)
}

// ---------------------------------------------------------------------------

export function isArray (value: any): value is any[] {
  return Array.isArray(value)
}

export function isNotEmptyIntArray (value: any) {
  return Array.isArray(value) && value.every(v => validator.default.isInt('' + v)) && value.length !== 0
}

export function isNotEmptyStringArray (value: any) {
  return Array.isArray(value) && value.every(v => typeof v === 'string' && v.length !== 0) && value.length !== 0
}

export function hasArrayLength (value: unknown[], options: { min?: number, max?: number }) {
  if (options.min !== undefined && value.length < options.min) return false
  if (options.max !== undefined && value.length > options.max) return false

  return true
}

export function isArrayOf (value: any, validator: (value: any) => boolean) {
  return isArray(value) && value.every(v => validator(v))
}

// ---------------------------------------------------------------------------

export function isDateValid (value: string) {
  return exists(value) && validator.default.isISO8601(value)
}

export function isIdValid (value: string) {
  return exists(value) && validator.default.isInt('' + value)
}

export function isUUIDValid (value: string) {
  return exists(value) && validator.default.isUUID('' + value, 4)
}

export function areUUIDsValid (values: string[]) {
  return isArray(values) && values.every(v => isUUIDValid(v))
}

export function isIdOrUUIDValid (value: string) {
  return isIdValid(value) || isUUIDValid(value)
}

export function isBooleanValid (value: any) {
  return typeof value === 'boolean' || (typeof value === 'string' && validator.default.isBoolean(value))
}

export function isIntOrNull (value: any) {
  return value === null || validator.default.isInt('' + value)
}

// ---------------------------------------------------------------------------

export function isFileValid (options: {
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

export function checkMimetypeRegex (fileMimeType: string, mimeTypeRegex: string) {
  return new RegExp(`^${mimeTypeRegex}$`, 'i').test(fileMimeType)
}

// ---------------------------------------------------------------------------

export function toCompleteUUID (value: string) {
  if (isShortUUID(value)) {
    try {
      return shortToUUID(value)
    } catch {
      return ''
    }
  }

  return value
}

export function toCompleteUUIDs (values: string[]) {
  return values.map(v => toCompleteUUID(v))
}

export function toIntOrNull (value: string) {
  const v = toValueOrNull(value)

  if (v === null || v === undefined) return v
  if (typeof v === 'number') return v

  return validator.default.toInt('' + v)
}

export function toBooleanOrNull (value: any) {
  const v = toValueOrNull(value)

  if (v === null || v === undefined) return v
  if (typeof v === 'boolean') return v

  return validator.default.toBoolean('' + v)
}

export function toValueOrNull (value: string) {
  if (value === 'null') return null

  return value
}

export function toIntArray (value: any) {
  if (!value) return []
  if (isArray(value) === false) return [ validator.default.toInt(value) ]

  return value.map(v => validator.default.toInt(v))
}
