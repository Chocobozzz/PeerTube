import validator from 'validator'
import { isArray } from './misc'

function isNumberArray (value: any) {
  return isArray(value) && value.every(v => validator.isInt('' + v))
}

function isStringArray (value: any) {
  return isArray(value) && value.every(v => typeof v === 'string')
}

function isNSFWQueryValid (value: any) {
  return value === 'true' || value === 'false' || value === 'both'
}

// ---------------------------------------------------------------------------

export {
  isNumberArray,
  isStringArray,
  isNSFWQueryValid
}
