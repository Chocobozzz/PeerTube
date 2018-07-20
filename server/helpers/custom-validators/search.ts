import * as validator from 'validator'
import 'express-validator'

import { isArray } from './misc'

function isNumberArray (value: any) {
  return isArray(value) && value.every(v => validator.isInt('' + v))
}

function isStringArray (value: any) {
  return isArray(value) && value.every(v => typeof v === 'string')
}

// ---------------------------------------------------------------------------

export {
  isNumberArray,
  isStringArray
}
