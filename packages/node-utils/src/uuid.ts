import short, { SUUID } from 'short-uuid'

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

export type { SUUID }
