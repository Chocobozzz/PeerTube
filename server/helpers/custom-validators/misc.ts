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

declare module 'express-validator' {
  export interface Validator {
    exists,
    isArray
  }
}
