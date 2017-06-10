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

declare global {
  namespace ExpressValidator {
    export interface Validator {
      exists,
      isArray
    }
  }
}
