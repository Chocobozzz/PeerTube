import short, { SUUID } from 'short-uuid'

const translator = short()

function buildUUID () {
  return short.uuid()
}

function buildSUUID (): SUUID {
  return short.generate()
}

function uuidToShort (uuid: string) {
  if (!uuid) return uuid

  return translator.fromUUID(uuid)
}

function shortToUUID (shortUUID: string) {
  if (!shortUUID) return shortUUID

  return translator.toUUID(shortUUID)
}

function isShortUUID (value: string) {
  if (!value) return false

  return value.length === translator.maxLength
}

export {
  buildUUID,
  buildSUUID,
  uuidToShort,
  shortToUUID,
  isShortUUID
}

export type { SUUID }
