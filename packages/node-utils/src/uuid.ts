import short, { SUUID } from 'short-uuid'
import { v5 } from 'uuid'

const translator = short()

export function buildUUID () {
  return short.uuid()
}

export function buildSUUID (): SUUID {
  return short.generate()
}

export function uuidToShort (uuid: string) {
  if (!uuid) return uuid

  return translator.fromUUID(uuid)
}

export function shortToUUID (shortUUID: string) {
  if (!shortUUID) return shortUUID

  return translator.toUUID(shortUUID)
}

export function isShortUUID (value: string) {
  if (!value) return false

  return value.length === translator.maxLength
}

export function buildUUIDv5FromURL (url: string) {
  return v5(url, v5.URL)
}

export type { SUUID }
