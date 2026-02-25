import { createTranslator, generate as generateShort } from 'short-uuid'
import { v4, v5 } from 'uuid'

const translator = createTranslator()

export function buildUUID () {
  return v4()
}

export function buildSUUID (): string {
  return generateShort()
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
