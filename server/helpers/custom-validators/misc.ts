import 'express-validator'

function exists (value: any) {
  return value !== undefined && value !== null
}

function isArray (value: any) {
  return Array.isArray(value)
}

// ---------------------------------------------------------------------------

export {
  exists,
  isArray
}
